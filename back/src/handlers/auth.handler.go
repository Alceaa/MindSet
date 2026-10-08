package handlers

import (
	"errors"
	"log"
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
	uniqueViolation      = "23505"
	loginCodeTTL         = 10 * time.Minute
	loginCodeMaxAttempts = 5
)

func Register(c *fiber.Ctx) error {
	var req models.RegisterReg

	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	if req.Password != req.PasswordConfirm {
		return utils.Fail(c, fiber.StatusBadRequest, "Пароли не совпадают", nil)
	}

	inviteID, err := resolveInvite(c, req.Invite)
	switch {
	case errors.Is(err, errInviteRequired):
		return utils.Fail(c, fiber.StatusForbidden, "Регистрация только по приглашению: нужна персональная ссылка", nil)
	case errors.Is(err, errInviteInvalid):
		return utils.Fail(c, fiber.StatusForbidden, "Приглашение недействительно, уже использовано или истекло", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	login := strings.TrimSpace(req.Login)
	email := strings.ToLower(strings.TrimSpace(req.Email))

	loginTaken, emailTaken, err := db.FindLoginOrEmailConflict(c.Context(), login, email)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}
	switch {
	case loginTaken && emailTaken:
		return utils.Fail(c, fiber.StatusConflict, "Такое имя пользователя и почта уже заняты", nil)
	case loginTaken:
		return utils.Fail(c, fiber.StatusConflict, "Такое имя пользователя уже занято", nil)
	case emailTaken:
		return utils.Fail(c, fiber.StatusConflict, "Такая почта уже зарегистрирована", nil)
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if _, err := db.DeleteExpiredPendingRegistrations(c.Context()); err != nil {
		log.Printf("[register] чистка просроченных заявок: %v", err)
	}

	if _, err := db.GetPendingRegistrationByLogin(c.Context(), login); err == nil {
		return utils.Fail(c, fiber.StatusConflict, "Такое имя пользователя ожидает подтверждения почты", nil)
	} else if !errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	pendingByEmail, err := db.GetPendingRegistrationByEmail(c.Context(), email)
	switch {
	case err == nil:
		if err := resendPendingRegistration(c, pendingByEmail); err != nil {
			return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить письмо, попробуйте позже", err)
		}
		return utils.Success(c, fiber.StatusAccepted, fiber.Map{
			"message": "Письмо с подтверждением отправлено повторно на " + email,
			"email":   email,
		})
	case !errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	return startPendingRegistration(c, login, email, hashedPassword, inviteID)
}

func startPendingRegistration(c *fiber.Ctx, login, email, hashedPassword string, inviteID int) error {
	token, tokenHash, err := mailer.NewToken()
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	ttlSeconds := int(verifyEmailTTL.Seconds())
	if inviteID > 0 {
		err = db.CreatePendingRegistrationWithInvite(c.Context(), login, email, hashedPassword, tokenHash, ttlSeconds, inviteID)
	} else {
		err = db.CreatePendingRegistration(c.Context(), login, email, hashedPassword, tokenHash, ttlSeconds)
	}

	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.As(err, &pgErr) && pgErr.Code == uniqueViolation:
			return utils.Fail(c, fiber.StatusConflict, "Такое имя пользователя или почта уже ожидают подтверждения", nil)
		case errors.Is(err, db.ErrNotFound):
			return utils.Fail(c, fiber.StatusForbidden, "Приглашение недействительно, уже использовано или истекло", nil)
		default:
			return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать заявку", err)
		}
	}

	if err := mailer.SendVerificationEmail(email, login, emailLink(c, "/verify-email", token), verifyEmailTTL); err != nil {
		if cancelErr := db.CancelPendingRegistration(c.Context(), login, inviteID); cancelErr != nil {
			log.Printf("[register] не удалось отменить заявку %s: %v", login, cancelErr)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить письмо, попробуйте позже", err)
	}

	return utils.Success(c, fiber.StatusAccepted, fiber.Map{
		"message": "Письмо с подтверждением отправлено на " + email,
		"email":   email,
	})
}

func Login(c *fiber.Ctx) error {
	var req models.LoginReg

	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	identifier := strings.TrimSpace(req.Login)

	var (
		user *models.User
		err  error
	)
	if strings.Contains(identifier, "@") {
		user, err = db.GetUserByEmail(c.Context(), strings.ToLower(identifier))
	} else {
		user, err = db.GetUserByLogin(c.Context(), identifier)
	}

	switch {
	case errors.Is(err, db.ErrNotFound):
		if hint := pendingRegistrationHint(c, identifier); hint != "" {
			return utils.Fail(c, fiber.StatusUnauthorized, hint, nil)
		}
		return utils.Fail(c, fiber.StatusUnauthorized, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if !utils.CheckPasswordHash(req.Password, user.Password) {
		return utils.Fail(c, fiber.StatusUnauthorized, "Неверный пароль", nil)
	}

	if user.IsBlocked() {
		message := "Аккаунт заблокирован"
		if reason := strings.TrimSpace(user.BlockedReason); reason != "" {
			message += ": " + reason
		}
		return utils.Fail(c, fiber.StatusForbidden, message, nil)
	}

	if utils.Config().RequireEmailVerification && !user.EmailVerified {
		return utils.Fail(c, fiber.StatusForbidden,
			"Почта не подтверждена: мы отправили письмо на "+user.Email, nil)
	}

	if user.TwoFactorEmail {
		return startTwoFactorLogin(c, user)
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Вход выполнен",
		"user":    user.Public(),
	})
}

func ConfirmLogin(c *fiber.Ctx) error {
	var req models.ConfirmLoginPayload

	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	user, err := findUserByIdentifier(c, strings.TrimSpace(req.Login))
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusUnauthorized, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if !utils.CheckPasswordHash(req.Password, user.Password) {
		return utils.Fail(c, fiber.StatusUnauthorized, "Неверный пароль", nil)
	}

	if user.IsBlocked() {
		return utils.Fail(c, fiber.StatusForbidden, "Аккаунт заблокирован", nil)
	}

	if !user.TwoFactorEmail {
		return utils.Fail(c, fiber.StatusConflict, "Для этого аккаунта вход с кодом выключен", nil)
	}

	userID, err := db.ConsumeEmailToken(c.Context(), db.EmailTokenLoginCode, mailer.HashToken(strings.TrimSpace(req.Code)))
	switch {
	case errors.Is(err, db.ErrNotFound):
		if attemptsErr := db.RegisterFailedLoginCode(c.Context(), user.ID, loginCodeMaxAttempts); attemptsErr != nil {
			log.Printf("[two-factor] счётчик попыток для %s не обновлён: %v", user.Login, attemptsErr)
		}
		return utils.Fail(c, fiber.StatusUnauthorized, "Неверный или устаревший код", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if userID != user.ID {
		return utils.Fail(c, fiber.StatusUnauthorized, "Неверный код", nil)
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Вход выполнен",
		"user":    user.Public(),
	})
}

func startTwoFactorLogin(c *fiber.Ctx, user *models.User) error {
	code, codeHash, err := mailer.NewCode()
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать код, попробуйте позже", err)
	}

	if err := db.CreateEmailToken(c.Context(), user.ID, db.EmailTokenLoginCode, codeHash, int(loginCodeTTL.Seconds())); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать код, попробуйте позже", err)
	}

	if err := mailer.SendLoginCode(user.Email, user.Login, code, loginCodeTTL); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить код на почту", err)
	}

	utils.ClearAuthCookies(c)

	return utils.Success(c, fiber.StatusAccepted, fiber.Map{
		"message":             "Код подтверждения отправлен на " + maskEmail(user.Email),
		"two_factor_required": true,
		"email":               maskEmail(user.Email),
	})
}

func findUserByIdentifier(c *fiber.Ctx, identifier string) (*models.User, error) {
	if strings.Contains(identifier, "@") {
		return db.GetUserByEmail(c.Context(), strings.ToLower(identifier))
	}
	return db.GetUserByLogin(c.Context(), identifier)
}

func pendingRegistrationHint(c *fiber.Ctx, identifier string) string {
	var (
		pending *db.PendingRegistration
		err     error
	)

	if strings.Contains(identifier, "@") {
		pending, err = db.GetPendingRegistrationByEmail(c.Context(), strings.ToLower(identifier))
	} else {
		pending, err = db.GetPendingRegistrationByLogin(c.Context(), identifier)
	}

	if err != nil || pending == nil {
		return ""
	}
	return "Аккаунт ещё не активирован: подтвердите почту по ссылке из письма"
}

func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return email
	}
	return email[:1] + "***" + email[at:]
}

func Refresh(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось продлить сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Сессия продлена",
		"user":    user.Public(),
	})
}

func Logout(c *fiber.Ctx) error {
	utils.ClearAuthCookies(c)
	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Вы вышли из аккаунта"})
}

func issueTokens(c *fiber.Ctx, user *models.User) error {
	accessToken, err := utils.CreateAccessToken(user)
	if err != nil {
		return err
	}

	refreshToken, err := utils.CreateRefreshToken(user)
	if err != nil {
		return err
	}

	utils.SetAuthCookies(c, accessToken, refreshToken)
	return nil
}
