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

func CreateSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.SetPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	set, err := db.CreateSet(c.Context(), &models.Set{
		UserID:      user.ID,
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		Content:     req.Content,
	})
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать сет", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Сет успешно создан",
		"set":     set,
	})
}

func GetSets(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	sets, err := db.GetSetsByUser(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сеты", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"sets": sets})
}

func GetSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", err)
	}

	set, err := db.GetSetByID(c.Context(), id, user.ID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сет", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"set": set})
}

func UpdateSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", err)
	}

	var req models.SetPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	set, err := db.UpdateSet(c.Context(), &models.Set{
		ID:          id,
		UserID:      user.ID,
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		Content:     req.Content,
	})
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить сет", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Сет сохранён",
		"set":     set,
	})
}

func DeleteSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", err)
	}

	if err := db.DeleteSet(c.Context(), id, user.ID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось удалить сет", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет удалён"})
}
