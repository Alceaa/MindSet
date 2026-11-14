package handlers

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// ListUserThemes отдаёт библиотеку тем: до ThemeLibraryLimit сохранённых оформлений.
func ListUserThemes(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	items, err := db.ListUserThemes(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить темы", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"themes":      items,
		"limit":       models.ThemeLibraryLimit,
		"base_themes": models.ThemeBaseKeys,
		"modes":       models.ThemeModes,
		"roles":       models.ThemeRoleKeys,
	})
}

// CreateUserTheme сохраняет тему в библиотеку пользователя.
func CreateUserTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	payload, ok := themePayloadFromRequest(c)
	if !ok {
		return nil
	}

	total, err := db.CountUserThemes(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать темы", err)
	}
	if total >= models.ThemeLibraryLimit {
		return utils.Fail(c, fiber.StatusConflict,
			fmt.Sprintf("Уже %d тем — удалите ненужную, чтобы сохранить новую", models.ThemeLibraryLimit), nil)
	}

	item, err := db.CreateUserTheme(c.Context(), user.ID, payload)
	if err != nil {
		return writeThemeError(c, err, "Не удалось сохранить тему")
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Тема сохранена",
		"theme":   item,
	})
}

// UpdateUserTheme переписывает сохранённую тему: название, описание, роли и база.
func UpdateUserTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	payload, ok := themePayloadFromRequest(c)
	if !ok {
		return nil
	}

	item, err := db.UpdateUserTheme(c.Context(), user.ID, id, payload)
	if err != nil {
		return writeThemeError(c, err, "Не удалось сохранить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Тема обновлена",
		"theme":   item,
	})
}

func DeleteUserTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	if err := db.DeleteUserTheme(c.Context(), user.ID, id); err != nil {
		return writeThemeError(c, err, "Не удалось удалить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Тема удалена"})
}

// themePayloadFromRequest разбирает тему: приходит восемь ролей, а не переменные.
// Ключ у клиента не спрашиваем — он собирается из названия.
func themePayloadFromRequest(c *fiber.Ctx) (models.ThemePayload, bool) {
	var req models.ThemePayload

	if err := c.BodyParser(&req); err != nil {
		_ = utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
		return req, false
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		_ = utils.FailValidation(c, validationErrors)
		return req, false
	}

	req.Title = strings.TrimSpace(req.Title)
	if utf8.RuneCountInString(req.Title) > models.ThemeTitleMaxLength {
		_ = utils.Fail(c, fiber.StatusBadRequest, "Название темы слишком длинное", nil)
		return req, false
	}

	req.Description = strings.TrimSpace(req.Description)
	if utf8.RuneCountInString(req.Description) > models.ThemeDescriptionMax {
		_ = utils.Fail(c, fiber.StatusBadRequest, "Описание темы слишком длинное", nil)
		return req, false
	}

	if !models.ValidThemeBase(req.Base) {
		_ = utils.Fail(c, fiber.StatusBadRequest, "Неизвестная базовая тема", nil)
		return req, false
	}

	req.Roles = models.NormalizeThemeRoles(req.Roles)
	if err := models.ValidateThemeRoles(req.Roles); err != nil {
		_ = utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
		return req, false
	}

	return req, true
}

func writeThemeError(c *fiber.Ctx, err error, fallback string) error {
	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Тема не найдена", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}
