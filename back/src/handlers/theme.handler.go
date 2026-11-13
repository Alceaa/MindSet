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
	"github.com/jackc/pgx/v5/pgconn"
)

const themeKeyConflict = "theme_packages_key_uq"

func ListOwnThemes(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	items, err := db.ListOwnThemePackages(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить свои темы", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"themes":      items,
		"limit":       models.ThemeMaxPackagesPerUser,
		"base_themes": models.ThemeBaseKeys,
		"modes":       models.ThemeModes,
		"variables":   models.ThemeColorVariables,
	})
}

func CreateTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	payload, ok := themePayloadFromRequest(c)
	if !ok {
		return nil
	}

	total, err := db.CountOwnThemePackages(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать темы", err)
	}
	if total >= models.ThemeMaxPackagesPerUser {
		return utils.Fail(c, fiber.StatusConflict,
			fmt.Sprintf("Уже %d тем — удалите ненужные", models.ThemeMaxPackagesPerUser), nil)
	}

	item, err := db.CreateThemePackage(c.Context(), user.ID, payload)
	if err != nil {
		return writeThemeError(c, err, "Не удалось сохранить тему")
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Черновик сохранён: отправьте тему на модерацию, когда она будет готова.",
		"theme":   item,
	})
}

func UpdateTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	existing, err := db.GetOwnThemePackage(c.Context(), user.ID, id)
	if err != nil {
		return writeThemeError(c, err, "Не удалось загрузить тему")
	}
	if existing.Status != models.ThemeStatusDraft && existing.Status != models.ThemeStatusRejected {
		return utils.Fail(c, fiber.StatusConflict, "Тема на модерации или опубликована — правки недоступны", nil)
	}

	payload, ok := themePayloadFromRequest(c)
	if !ok {
		return nil
	}

	item, err := db.UpdateThemePackage(c.Context(), user.ID, id, payload)
	if err != nil {
		return writeThemeError(c, err, "Не удалось сохранить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Тема обновлена",
		"theme":   item,
	})
}

func DeleteTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	if err := db.DeleteThemePackage(c.Context(), user.ID, id); err != nil {
		return writeThemeError(c, err, "Не удалось удалить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Тема удалена"})
}

func SubmitTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор темы", nil)
	}

	existing, err := db.GetOwnThemePackage(c.Context(), user.ID, id)
	if err != nil {
		return writeThemeError(c, err, "Не удалось загрузить тему")
	}
	if existing.Status == models.ThemeStatusPending {
		return utils.Fail(c, fiber.StatusConflict, "Тема уже на модерации", nil)
	}
	if existing.Status == models.ThemeStatusApproved {
		return utils.Fail(c, fiber.StatusConflict, "Тема уже опубликована", nil)
	}

	item, err := db.SubmitThemePackage(c.Context(), user.ID, id)
	if err != nil {
		return writeThemeError(c, err, "Не удалось отправить тему на модерацию")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Тема отправлена на модерацию",
		"theme":   item,
	})
}

func ListPublishedThemes(c *fiber.Ctx) error {
	items, err := db.ListPublishedThemes(c.Context())
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить темы", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"themes": items})
}

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

	req.Key = strings.ToLower(strings.TrimSpace(req.Key))
	if !models.ValidThemeKey(req.Key) {
		_ = utils.Fail(c, fiber.StatusBadRequest,
			"Ключ темы: латиница, цифры и дефис, от 3 до 32 символов", nil)
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

	variables := make(map[string]string, len(req.Variables))
	for name, value := range req.Variables {
		variables[strings.TrimSpace(name)] = strings.TrimSpace(value)
	}
	if err := models.ValidateThemeVariables(variables); err != nil {
		_ = utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
		return req, false
	}
	req.Variables = variables

	return req, true
}

func writeThemeError(c *fiber.Ctx, err error, fallback string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation && pgErr.ConstraintName == themeKeyConflict {
		return utils.Fail(c, fiber.StatusConflict, "Тема с таким ключом уже есть — выберите другой", nil)
	}

	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Тема не найдена", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}
