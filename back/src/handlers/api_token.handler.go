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

func ListAPITokens(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	tokens, err := db.ListAPITokens(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить токены", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"tokens":         tokens,
		"limit":          models.APITokenMaxPerUser,
		"expiry_choices": models.APITokenExpiryChoices,
	})
}

func CreateAPIToken(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.APITokenPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return utils.Fail(c, fiber.StatusBadRequest, "Название токена не может быть пустым", nil)
	}
	if utf8.RuneCountInString(title) > models.APITokenTitleMaxLength {
		return utils.Fail(c, fiber.StatusBadRequest, "Название токена слишком длинное", nil)
	}
	if !models.ValidAPITokenExpiry(req.ExpiresInDays) {
		return utils.Fail(c, fiber.StatusBadRequest, "Недопустимый срок действия токена", nil)
	}

	total, err := db.CountAPITokens(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать токены", err)
	}
	if total >= models.APITokenMaxPerUser {
		return utils.Fail(c, fiber.StatusConflict,
			fmt.Sprintf("Уже %d токенов — отзовите ненужные", models.APITokenMaxPerUser), nil)
	}

	value, err := utils.NewAPIToken()
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать токен", err)
	}

	token, err := db.CreateAPIToken(c.Context(), user.ID, title,
		utils.APITokenLabel(value), utils.HashAPIToken(value), req.ExpiresInDays)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить токен", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Токен создан. Скопируйте значение: больше оно не показывается.",
		"token":   token,
		"value":   value,
	})
}

func RevokeAPIToken(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор токена", nil)
	}

	if err := db.DeleteAPIToken(c.Context(), user.ID, id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Токен не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отозвать токен", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Токен отозван"})
}
