package handlers

import (
	"errors"
	"strings"

	"mindset/db"
	"mindset/links"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func GetSavedSets(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	saved, err := db.GetSavedSets(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сохранённые сеты", err)
	}

	if err := db.AnnotateSavedSets(c.Context(), user.ID, saved); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось определить состояние снимков", err)
	}

	attention := make([]*models.SavedSet, 0)
	for _, item := range saved {
		if item.State == models.SnapshotStateAttention {
			attention = append(attention, item)
		}
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"saved":           saved,
		"attention":       attention,
		"attention_count": len(attention),
	})
}

func GetSavedSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", err)
	}

	saved, err := db.GetSavedSet(c.Context(), user.ID, id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Снимок не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить снимок", err)
	}

	if err := db.AnnotateSavedSets(c.Context(), user.ID, []*models.SavedSet{saved}); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось определить состояние снимка", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"saved":      []*models.SavedSet{saved},
		"saved_item": saved,
	})
}

func SaveExternalSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.SavedSetPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	slug := strings.TrimSpace(req.Slug)
	if !links.IsValidSlug(slug) {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный адрес сета", nil)
	}

	source, author, err := db.GetPublicSetBySlugWithAuthor(c.Context(), slug)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сет", err)
	}

	if source.UserID == user.ID {
		return utils.Fail(c, fiber.StatusBadRequest, "Этот сет уже принадлежит вам", nil)
	}

	if source.ForbidCopies {
		return utils.Fail(c, fiber.StatusForbidden, "Автор запретил сохранение копий этого сета", nil)
	}

	saved, err := db.SaveSet(c.Context(), user.ID, source, author, false)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить сет", err)
	}

	if err := db.AnnotateSavedSets(c.Context(), user.ID, []*models.SavedSet{saved}); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось определить состояние снимка", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message":    "Сет сохранён в библиотеку",
		"saved":      []*models.SavedSet{saved},
		"saved_item": saved,
	})
}

func RefreshSavedSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", err)
	}

	existing, err := db.GetSavedSet(c.Context(), user.ID, id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Снимок не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить снимок", err)
	}

	if existing.SetID == 0 {
		return utils.Fail(c, fiber.StatusConflict, "Исходный сет удалён, обновление невозможно", nil)
	}

	source, author, err := db.GetSetByIDForSnapshot(c.Context(), existing.SetID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Исходный сет больше не существует", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить исходный сет", err)
	}

	if !source.Visibility.ReadableByOthers() {
		return utils.Fail(c, fiber.StatusForbidden, "Автор закрыл доступ к исходному сету", nil)
	}

	saved, err := db.SaveSet(c.Context(), user.ID, source, author, true)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось обновить снимок", err)
	}

	if err := db.AnnotateSavedSets(c.Context(), user.ID, []*models.SavedSet{saved}); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось определить состояние снимка", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message":    "Снимок обновлён",
		"saved":      []*models.SavedSet{saved},
		"saved_item": saved,
	})
}

func FreezeSavedSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", err)
	}

	var req struct {
		Frozen bool `json:"frozen"`
	}
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
		}
	}

	if err := db.SetFrozen(c.Context(), user.ID, id, req.Frozen); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Снимок не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось изменить заморозку", err)
	}

	saved, err := db.GetSavedSet(c.Context(), user.ID, id)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить снимок", err)
	}
	if err := db.AnnotateSavedSets(c.Context(), user.ID, []*models.SavedSet{saved}); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось определить состояние снимка", err)
	}

	if saved.SetID == 0 {
		return utils.Fail(c, fiber.StatusConflict, "Заморозка недоступна: источник удалён", nil)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message":    "Заморозка обновлена",
		"saved":      []*models.SavedSet{saved},
		"saved_item": saved,
	})
}

func DeleteSavedSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", err)
	}

	if err := db.DeleteSavedSet(c.Context(), user.ID, id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Снимок не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось убрать сет из библиотеки", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет убран из библиотеки"})
}

func GetPublicSnapshot(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", err)
	}

	saved, err := db.GetPublicSnapshot(c.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Снимок не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить снимок", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"snapshot": saved})
}
