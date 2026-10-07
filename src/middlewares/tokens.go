package middlewares

import (
	"errors"
	"strconv"
	"strings"

	"mindset/db"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

const UserLocalKey = "user"

func CurrentUser(c *fiber.Ctx) (*models.User, bool) {
	user, ok := c.Locals(UserLocalKey).(*models.User)
	return user, ok && user != nil
}

func ValidateAccessToken(c *fiber.Ctx) error {
	token := accessTokenFromRequest(c)
	if token == "" {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	claims, err := utils.ParseAccessToken(token)
	if err != nil {
		return utils.Fail(c, fiber.StatusUnauthorized, "Сессия истекла, войдите заново", err)
	}

	user, err := loadUserFromSubject(c, claims.Subject)
	if err != nil {
		return err
	}

	c.Locals(UserLocalKey, user)
	return c.Next()
}

func ValidateRefreshToken(c *fiber.Ctx) error {
	token := refreshTokenFromRequest(c)
	if token == "" {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	claims, err := utils.ParseRefreshToken(token)
	if err != nil {
		return utils.Fail(c, fiber.StatusUnauthorized, "Сессия истекла, войдите заново", err)
	}

	user, err := loadUserFromSubject(c, claims.Subject)
	if err != nil {
		return err
	}

	c.Locals(UserLocalKey, user)
	return c.Next()
}

func loadUserFromSubject(c *fiber.Ctx, subject string) (*models.User, error) {
	userID, err := strconv.Atoi(subject)
	if err != nil {
		return nil, utils.Fail(c, fiber.StatusUnauthorized, "Некорректный токен", err)
	}

	user, err := db.GetUserById(c.Context(), userID)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return nil, utils.Fail(c, fiber.StatusUnauthorized, "Пользователь не найден, войдите заново", err)
	case err != nil:
		return nil, utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}
	return user, nil
}

func accessTokenFromRequest(c *fiber.Ctx) string {
	if header := c.Get(fiber.HeaderAuthorization); strings.HasPrefix(header, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	}
	return c.Cookies(utils.AccessTokenCookie)
}

func refreshTokenFromRequest(c *fiber.Ctx) string {
	if cookie := c.Cookies(utils.RefreshTokenCookie); cookie != "" {
		return cookie
	}
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&body); err == nil && body.RefreshToken != "" {
		return body.RefreshToken
	}
	return ""
}
