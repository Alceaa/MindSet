package handlers

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"mindset/db"
	"mindset/media"
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

	attachments, err := bugReportAttachments(req.Attachments)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	author := ""
	authorID := 0
	if user, ok := middlewares.CurrentUser(c); ok {
		author = user.Login
		authorID = user.ID
	}

	page := strings.TrimSpace(req.Page)
	topic := strings.TrimSpace(req.Topic)
	message := strings.TrimSpace(req.Message)

	text := notify.BugReportText(author, page, topic, message, attachments)

	if err := db.CreateBugReport(c.Context(), authorID, author, page, topic, message, attachments); err != nil {
		log.Printf("[reports] репорт не сохранён в БД: %v", err)
	}

	if err := notify.Send(text); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отправить отчёт, попробуйте позже", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{"message": "Спасибо! Отчёт отправлен"})
}

// Вложения отчёта: только ссылки из нашего хранилища, не больше BugReportMaxAttachments
// штук и без повторов. Проверяем адрес, потому что он приходит от клиента, а уведомление
// получают живые люди.
func bugReportAttachments(raw []string) ([]string, error) {
	attachments := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))

	for _, item := range raw {
		link := strings.TrimSpace(item)
		if link == "" || seen[link] {
			continue
		}
		if len(attachments) >= models.BugReportMaxAttachments {
			return nil, fmt.Errorf("к отчёту можно приложить не больше %d изображений",
				models.BugReportMaxAttachments)
		}
		if !media.IsPublicURL(link) {
			return nil, errors.New("изображение не из нашего хранилища — загрузите его заново")
		}

		seen[link] = true
		attachments = append(attachments, link)
	}

	return attachments, nil
}
