package handlers

import (
	"mindset/db"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// Health проверяет, что сервер жив и БД отвечает.
func Health(c *fiber.Ctx) error {
	if err := db.Health(c.Context()); err != nil {
		return utils.Fail(c, fiber.StatusServiceUnavailable, "База данных недоступна", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "ok"})
}
