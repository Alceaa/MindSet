package utils

import (
	"log"

	"mindset/models"

	"github.com/gofiber/fiber/v2"
)

func Success(c *fiber.Ctx, status int, data fiber.Map) error {
	payload := fiber.Map{"status": "success"}
	for key, value := range data {
		payload[key] = value
	}
	return c.Status(status).JSON(payload)
}

func Fail(c *fiber.Ctx, status int, message string, err error) error {
	payload := fiber.Map{"status": "fail", "message": message}
	if err != nil {
		log.Printf("[error] %s %s: %v", c.Method(), c.Path(), err)
		if !Config().IsProduction() {
			payload["dev"] = err.Error()
		}
	}
	return c.Status(status).JSON(payload)
}

func FailValidation(c *fiber.Ctx, errors []*models.ErrorResponse) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"status":  "fail",
		"message": "Проверьте правильность заполнения полей",
		"errors":  errors,
	})
}
