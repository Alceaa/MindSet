package handlers

import (
	"errors"
	"strings"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
)

// uniqueViolation — код ошибки PostgreSQL на нарушение UNIQUE.
const uniqueViolation = "23505"

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

	user, err := db.CreateUser(c.Context(), &models.User{
		Login:    login,
		Email:    email,
		Password: hashedPassword,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return utils.Fail(c, fiber.StatusConflict, "Пользователь с такими данными уже существует", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать пользователя", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Пользователь успешно создан",
		"user":    user.Public(),
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
		return utils.Fail(c, fiber.StatusUnauthorized, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if !utils.CheckPasswordHash(req.Password, user.Password) {

		return utils.Fail(c, fiber.StatusUnauthorized, "Неверный пароль", nil)
	}

	if err := issueTokens(c, user); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать сессию", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Вход выполнен",
		"user":    user.Public(),
	})
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
