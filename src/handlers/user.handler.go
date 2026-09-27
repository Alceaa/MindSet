package handlers

import (
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// Нужен фронтенду, чтобы при загрузке приложения понять, авторизован ли
// пользователь: токены лежат в HttpOnly cookie, и прочитать их из JS нельзя.
func Me(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"user": user.Public()})
}
