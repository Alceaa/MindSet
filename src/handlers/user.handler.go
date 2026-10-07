package handlers

import (
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func Me(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"user": user.Public()})
}
