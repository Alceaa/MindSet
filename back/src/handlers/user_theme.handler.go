package handlers

import (
	"errors"
	"strings"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// GetMyTheme отдаёт тему оформления из профиля (null, если своя тема не задана).
func GetMyTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	theme, err := db.GetUserTheme(c.Context(), user.ID)
	if err != nil {
		return writeUserThemeError(c, err, "Не удалось загрузить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"theme": theme})
}

// UpdateMyTheme сохраняет тему оформления: восемь ролей и базовая тема, без модерации.
func UpdateMyTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.UserTheme
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}
	if err := models.ValidateUserTheme(req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Roles = models.NormalizeUserThemeRoles(req.Roles)

	if err := db.UpdateUserTheme(c.Context(), user.ID, req); err != nil {
		return writeUserThemeError(c, err, "Не удалось сохранить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Тема сохранена",
		"theme":   req,
	})
}

// ClearMyTheme возвращает базовое оформление — кнопка «Сбросить» в настройках.
func ClearMyTheme(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	if err := db.ClearUserTheme(c.Context(), user.ID); err != nil {
		return writeUserThemeError(c, err, "Не удалось сбросить тему")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Своя тема удалена",
		"theme":   nil,
	})
}

func writeUserThemeError(c *fiber.Ctx, err error, fallback string) error {
	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Пользователь не найден", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}
