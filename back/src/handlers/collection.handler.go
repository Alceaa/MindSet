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
	"github.com/jackc/pgx/v5/pgconn"
)

const collectionTitleConflict = "collections_user_title_key_idx"

// ListCollections — свои коллекции по порядку, с числом сетов и снимков.
func ListCollections(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	collections, err := db.ListCollections(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить коллекции", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"collections": collections})
}

// CreateCollection — новая полка в конце списка.
func CreateCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.CollectionPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	title, color, err := collectionFields(req)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	collection, err := db.CreateCollection(c.Context(), user.ID, title, links.NormalizeTitle(title), color)
	if err != nil {
		return writeCollectionError(c, err, "Не удалось создать коллекцию")
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{"collection": collection})
}

// UpdateCollection — переименование, цвет и место в списке.
func UpdateCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор коллекции", nil)
	}

	var req models.CollectionPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	title, color, err := collectionFields(req)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	collection, err := db.UpdateCollection(c.Context(), user.ID, id, title, links.NormalizeTitle(title), color, req.Position)
	if err != nil {
		return writeCollectionError(c, err, "Не удалось сохранить коллекцию")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"collection": collection})
}

// DeleteCollection — сеты остаются, уходят только связи с коллекцией.
func DeleteCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор коллекции", nil)
	}

	if err := db.DeleteCollection(c.Context(), user.ID, id); err != nil {
		return writeCollectionError(c, err, "Не удалось удалить коллекцию")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Коллекция удалена"})
}

// AddSetCollection — положить сет в коллекцию. Сет может лежать сразу в нескольких.
func AddSetCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", nil)
	}

	req, err := parseCollectionAssign(c)
	if err != nil {
		return err
	}
	if req.CollectionID <= 0 {
		return utils.Fail(c, fiber.StatusBadRequest, "Не указана коллекция", nil)
	}

	if err := db.AddSetCollection(c.Context(), user.ID, id, req.CollectionID); err != nil {
		return writeCollectionError(c, err, "Не удалось положить сет в коллекцию")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет добавлен в коллекцию"})
}

// RemoveSetCollection — убрать сет из коллекции. Сам сет остаётся.
func RemoveSetCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", nil)
	}

	collectionID, err := c.ParamsInt("collectionId")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор коллекции", nil)
	}

	if err := db.RemoveSetCollection(c.Context(), user.ID, id, collectionID); err != nil {
		return writeCollectionError(c, err, "Не удалось убрать сет из коллекции")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет убран из коллекции"})
}

// AddSavedSetCollection — то же для сохранённого снимка.
func AddSavedSetCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", nil)
	}

	req, err := parseCollectionAssign(c)
	if err != nil {
		return err
	}
	if req.CollectionID <= 0 {
		return utils.Fail(c, fiber.StatusBadRequest, "Не указана коллекция", nil)
	}

	if err := db.AddSavedSetCollection(c.Context(), user.ID, id, req.CollectionID); err != nil {
		return writeCollectionError(c, err, "Не удалось положить снимок в коллекцию")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Снимок добавлен в коллекцию"})
}

// RemoveSavedSetCollection — убрать снимок из коллекции.
func RemoveSavedSetCollection(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор снимка", nil)
	}

	collectionID, err := c.ParamsInt("collectionId")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор коллекции", nil)
	}

	if err := db.RemoveSavedSetCollection(c.Context(), user.ID, id, collectionID); err != nil {
		return writeCollectionError(c, err, "Не удалось убрать снимок из коллекции")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Снимок убран из коллекции"})
}

// collectionFields проверяет название и цвет метки.
func collectionFields(req models.CollectionPayload) (string, string, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return "", "", errCollectionTitleEmpty
	}

	color := strings.TrimSpace(req.Color)
	if !models.ValidCollectionColor(color) {
		return "", "", errCollectionColorUnknown
	}

	return title, color, nil
}

var (
	errCollectionTitleEmpty   = errors.New("название коллекции не может быть пустым")
	errCollectionColorUnknown = errors.New("неизвестный цвет метки")
)

// parseCollectionAssign читает тело запроса на назначение коллекции.
func parseCollectionAssign(c *fiber.Ctx) (models.CollectionAssignPayload, error) {
	var req models.CollectionAssignPayload

	if err := c.BodyParser(&req); err != nil {
		return req, utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return req, utils.FailValidation(c, validationErrors)
	}

	return req, nil
}

// writeCollectionError переводит ошибки базы в ответы API: понятное сообщение вместо 500.
func writeCollectionError(c *fiber.Ctx, err error, fallback string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation && pgErr.ConstraintName == collectionTitleConflict {
		return utils.Fail(c, fiber.StatusConflict, "Коллекция с таким названием уже есть", nil)
	}

	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Коллекция или сет не найдены", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}

