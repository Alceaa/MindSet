package middlewares

import (
	"errors"
	"log"
	"strings"

	"mindset/db"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

const APITokenLocalKey = "api_token"

func CurrentAPIToken(c *fiber.Ctx) (*models.APIToken, bool) {
	token, ok := c.Locals(APITokenLocalKey).(*models.APIToken)
	return token, ok && token != nil
}

func ValidateAPIToken(c *fiber.Ctx) error {
	value := apiTokenFromRequest(c)
	if value == "" {
		return utils.Fail(c, fiber.StatusUnauthorized, "Нужен токен интеграции: Authorization: Bearer msk_…", nil)
	}

	token, userID, err := db.GetAPITokenByHash(c.Context(), utils.HashAPIToken(value))
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusUnauthorized, "Токен не найден или отозван", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if token.Expired {
		return utils.Fail(c, fiber.StatusUnauthorized, "Срок действия токена истёк", nil)
	}

	user, err := db.GetUserById(c.Context(), userID)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusUnauthorized, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if user.IsBlocked() {
		return utils.Fail(c, fiber.StatusForbidden, "Аккаунт заблокирован", nil)
	}

	if err := db.TouchAPIToken(c.Context(), token.ID); err != nil {
		log.Printf("[api] не удалось отметить использование токена %d: %v", token.ID, err)
	}

	c.Locals(UserLocalKey, user)
	c.Locals(APITokenLocalKey, token)

	return c.Next()
}

func apiTokenFromRequest(c *fiber.Ctx) string {
	header := strings.TrimSpace(c.Get(fiber.HeaderAuthorization))
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}

	value := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if !utils.IsAPIToken(value) {
		return ""
	}

	return value
}
