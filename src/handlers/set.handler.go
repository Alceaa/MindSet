package handlers

import (
	"mindset/db"
	"mindset/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

func CreateSet(c *fiber.Ctx) error {
	var req *models.Set

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": err.Error()})
	}

	req.DateCreated = time.Now().Format(time.DateTime)
	req.LastActivity = time.Now().Format(time.DateTime)

	set, err := db.CreateSet(c.Context(), req)
	if err != nil || set == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "fail", "dev": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "successful", "message": "Сет успешно создан", "set": set})
}
