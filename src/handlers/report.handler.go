package handlers

import (
	"log"
	"strings"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/notify"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func CreateBugReport(c *fiber.Ctx) error {
	var req models.BugReportPayload

	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	author := ""
	authorID := 0
	if user, ok := middlewares.CurrentUser(c); ok {
		author = user.Login
		authorID = user.ID
	}

	text := notify.BugReportText(author,
		strings.TrimSpace(req.Page),
		strings.TrimSpace(req.Topic),
		strings.TrimSpace(req.Message),
	)

	if err := db.CreateBugReport(c.Context(), authorID, author,
		strings.TrimSpace(req.Page), strings.TrimSpace(req.Topic), strings.TrimSpace(req.Message)); err != nil {
		log.Printf("[reports] репорт не сохранён в БД: %v", err)
	}

	if err := notify.Send(text); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить отчёт, попробуйте позже", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{"message": "Спасибо! Отчёт отправлен"})
}
