package handlers

import (
	"errors"
	"log"
	"net/url"
	"strings"
	"time"

	"mindset/db"
	"mindset/mailer"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	verifyEmailTTL   = 24 * time.Hour
	passwordResetTTL = time.Hour
)

func RequestEmailVerification(c *fiber.Ctx) error {
	var req models.EmailPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	if user, ok := middlewares.CurrentUser(c); ok && strings.EqualFold(user.Email, email) {
		if user.EmailVerified {
			return utils.Fail(c, fiber.StatusConflict, "Почта уже подтверждена", nil)
		}
		if err := startEmailVerification(c, user); err != nil {
			return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить письмо, попробуйте позже", err)
		}
		return utils.Success(c, fiber.StatusOK, fiber.Map{
			"message": "Письмо отправлено на " + email,
		})
	}

	user, err := db.GetUserByEmail(c.Context(), email)
	switch {
	case errors.Is(err, db.ErrNotFound):
		if resendErr := resendPendingRegistrationByEmail(c, email); resendErr != nil && !errors.Is(resendErr, db.ErrNotFound) {
			log.Printf("[email] повторное письмо для %s не отправлено: %v", email, resendErr)
		}
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	case !user.EmailVerified:
		if sendErr := startEmailVerification(c, user); sendErr != nil {
			log.Printf("[email] письмо подтверждения для %s не отправлено: %v", email, sendErr)
		}
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Если адрес зарегистрирован и ещё не подтверждён, письмо уже отправлено",
	})
}

func VerifyEmail(c *fiber.Ctx) error {
	var req models.VerifyEmailPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	tokenHash := mailer.HashToken(strings.TrimSpace(req.Token))

	pending, err := db.GetPendingRegistrationByToken(c.Context(), tokenHash)
	switch {
	case err == nil:
		return completePendingRegistration(c, pending)
	case !errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	userID, err := db.ConsumeEmailToken(c.Context(),
		db.EmailTokenVerifyEmail, tokenHash)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusBadRequest, "Ссылка недействительна или устарела", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if err := db.SetEmailVerified(c.Context(), userID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось подтвердить почту", err)
	}

	user, err := db.GetUserById(c.Context(), userID)
	if err != nil {
		return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Почта подтверждена"})
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Почта подтверждена, но не удалось создать сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Почта подтверждена",
		"user":    user.Public(),
	})
}

func completePendingRegistration(c *fiber.Ctx, pending *db.PendingRegistration) error {
	user, err := db.CompletePendingRegistration(c.Context(), pending.ID)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusBadRequest, "Ссылка недействительна или устарела", nil)
	case err != nil:
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return utils.Fail(c, fiber.StatusConflict, "Такое имя пользователя или почта уже заняты", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать аккаунт", err)
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Аккаунт создан, но не удалось создать сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Почта подтверждена, аккаунт создан",
		"user":    user.Public(),
	})
}

func ForgotPassword(c *fiber.Ctx) error {
	var req models.EmailPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := db.GetUserByEmail(c.Context(), email)
	switch {
	case errors.Is(err, db.ErrNotFound):
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	default:
		if user.IsBlocked() {
			return utils.Success(c, fiber.StatusOK, fiber.Map{
				"message": "Если такая почта зарегистрирована, письмо со ссылкой уже отправлено",
			})
		}
		if sendErr := sendPasswordReset(c, user); sendErr != nil {
			log.Printf("[email] письмо сброса пароля для %s не отправлено: %v", email, sendErr)
		}
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Если такая почта зарегистрирована, письмо со ссылкой уже отправлено",
	})
}

func ResetPassword(c *fiber.Ctx) error {
	var req models.ResetPasswordPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	userID, err := db.ConsumeEmailToken(c.Context(),
		db.EmailTokenPasswordReset, mailer.HashToken(strings.TrimSpace(req.Token)))
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusBadRequest, "Ссылка недействительна или устарела", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	hashed, err := utils.HashPassword(req.Password)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить пароль", err)
	}
	if err := db.UpdatePassword(c.Context(), userID, hashed); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось обновить пароль", err)
	}
	if err := db.BumpTokenEpoch(c.Context(), userID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Пароль изменён, но сессии не сброшены", err)
	}

	utils.ClearAuthCookies(c)

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Пароль изменён, войдите с новым паролем",
	})
}

func startEmailVerification(c *fiber.Ctx, user *models.User) error {
	token, hash, err := mailer.NewToken()
	if err != nil {
		return err
	}
	if err := db.CreateEmailToken(c.Context(), user.ID,
		db.EmailTokenVerifyEmail, hash, int(verifyEmailTTL.Seconds())); err != nil {
		return err
	}
	return mailer.SendVerificationEmail(user.Email, user.Login, emailLink(c, "/verify-email", token), verifyEmailTTL)
}

func resendPendingRegistrationByEmail(c *fiber.Ctx, email string) error {
	pending, err := db.GetPendingRegistrationByEmail(c.Context(), email)
	if err != nil {
		return err
	}
	return resendPendingRegistration(c, pending)
}

func resendPendingRegistration(c *fiber.Ctx, pending *db.PendingRegistration) error {
	token, hash, err := mailer.NewToken()
	if err != nil {
		return err
	}
	if err := db.RefreshPendingRegistrationToken(c.Context(), pending.ID, hash, int(verifyEmailTTL.Seconds())); err != nil {
		return err
	}
	return mailer.SendVerificationEmail(pending.Email, pending.Login, emailLink(c, "/verify-email", token), verifyEmailTTL)
}

func sendPasswordReset(c *fiber.Ctx, user *models.User) error {
	token, hash, err := mailer.NewToken()
	if err != nil {
		return err
	}
	if err := db.CreateEmailToken(c.Context(), user.ID,
		db.EmailTokenPasswordReset, hash, int(passwordResetTTL.Seconds())); err != nil {
		return err
	}
	return mailer.SendPasswordResetEmail(user.Email, user.Login, emailLink(c, "/reset", token), passwordResetTTL)
}

func emailLink(c *fiber.Ctx, path, token string) string {
	base := utils.Config().BaseURL()
	if base == "" {
		base = strings.TrimRight(c.BaseURL(), "/")
	}
	return base + path + "?token=" + url.QueryEscape(token)
}
