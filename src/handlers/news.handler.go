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

const newsPageSize = 20

func CreateAdminNews(c *fiber.Ctx) error {
	admin, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.NewsPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	item, err := db.CreateNews(c.Context(), strings.TrimSpace(req.Title), req.Body, req.IsPublished, req.IsPinned, admin.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить новость", err)
	}

	recordAction(c, "create_news", "news", item.ID, item.Title)

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Новость опубликована",
		"news":    item,
	})
}

func UpdateAdminNews(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор новости", err)
	}

	var req models.NewsPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	item, err := db.UpdateNews(c.Context(), id, strings.TrimSpace(req.Title), req.Body, req.IsPublished, req.IsPinned)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Новость не найдена", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить новость", err)
	}

	recordAction(c, "update_news", "news", id, item.Title)

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Новость обновлена",
		"news":    item,
	})
}

func DeleteAdminNews(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор новости", err)
	}

	err = db.DeleteNews(c.Context(), id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Новость не найдена", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось удалить новость", err)
	}

	recordAction(c, "delete_news", "news", id, "")

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Новость удалена"})
}

func ListAdminNews(c *fiber.Ctx) error {
	items, err := db.ListNews(c.Context(), false, c.QueryInt("limit", newsPageSize), c.QueryInt("offset", 0))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить новости", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"news": items})
}

func ListNews(c *fiber.Ctx) error {
	items, err := db.ListNews(c.Context(), true, c.QueryInt("limit", newsPageSize), c.QueryInt("offset", 0))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить новости", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"news": items})
}

func GetNewsItem(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор новости", err)
	}

	item, err := db.GetNews(c.Context(), id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Новость не найдена", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить новость", err)
	}

	if !item.IsPublished {
		if user, ok := middlewares.CurrentUser(c); !ok || !user.IsAdmin() {
			return utils.Fail(c, fiber.StatusNotFound, "Новость не найдена", nil)
		}
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"news": item})
}
