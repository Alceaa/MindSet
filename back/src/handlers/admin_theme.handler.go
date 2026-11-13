package handlers

import (
	"strings"
	"unicode/utf8"

	"mindset/db"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func ListAdminThemes(c *fiber.Ctx) error {
	status := strings.TrimSpace(c.Query("status"))
	limit := c.QueryInt("limit", 50)

	items, err := db.ListThemePackagesByStatus(c.Context(), status, limit)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить темы", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"themes": items})
}

func ModerateTheme(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	var req models.ThemeStatusPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	note := strings.TrimSpace(req.Note)
	if req.Status == models.ThemeStatusRejected && note == "" {
		return utils.Fail(c, fiber.StatusBadRequest, "Укажите причину отказа — её увидит автор", nil)
	}
	if utf8.RuneCountInString(note) > models.ThemeModerationNoteMax {
		return utils.Fail(c, fiber.StatusBadRequest, "Комментарий слишком длинный", nil)
	}
	if req.Status == models.ThemeStatusApproved {
		note = ""
	}

	item, err := db.ModerateThemePackage(c.Context(), id, req.Status, note)
	if err != nil {
		return writeThemeError(c, err, "Не удалось обновить статус темы")
	}

	recordAction(c, "theme_"+req.Status, "theme", item.ID, item.Key)

	message := "Тема опубликована"
	if req.Status == models.ThemeStatusRejected {
		message = "Тема отклонена"
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": message, "theme": item})
}
