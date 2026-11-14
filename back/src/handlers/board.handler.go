package handlers

import (
	"encoding/json"
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

const boardTitleConflict = "boards_user_title_key_idx"

// ListBoards — свои доски: последние изменённые сверху, без сцен.
func ListBoards(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	boards, err := db.ListBoards(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить доски", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"boards": boards})
}

// CreateBoard — новая доска. Сцену можно прислать сразу: так работает
// восстановление черновика, который редактор держал в localStorage.
func CreateBoard(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.BoardPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	title, visibility, err := boardFields(req)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	doc, err := boardDoc(req.Doc)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Сцена доски должна быть объектом JSON", err)
	}

	board, err := db.CreateBoard(c.Context(), user.ID, title, links.NormalizeTitle(title), visibility, doc)
	if err != nil {
		return writeBoardError(c, err, "Не удалось создать доску")
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{"board": board})
}

// GetBoard — своя доска вместе со сценой.
func GetBoard(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор доски", nil)
	}

	board, err := db.GetBoard(c.Context(), user.ID, id)
	if err != nil {
		return writeBoardError(c, err, "Не удалось открыть доску")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"board": board})
}

// UpdateBoard — переименование и видимость; сцену сохраняет отдельный запрос.
func UpdateBoard(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор доски", nil)
	}

	var req models.BoardPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	title, visibility, err := boardFields(req)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	board, err := db.UpdateBoard(c.Context(), user.ID, id, title, links.NormalizeTitle(title), visibility)
	if err != nil {
		return writeBoardError(c, err, "Не удалось сохранить доску")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"board": board})
}

// SaveBoardDoc — автосохранение сцены. Редактор зовёт его с задержкой после правки,
// поэтому ответ короткий: клиенту нужен только факт сохранения.
func SaveBoardDoc(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор доски", nil)
	}

	var req models.BoardDocPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	doc, err := boardDoc(req.Doc)
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Сцена доски должна быть объектом JSON", err)
	}

	if err := db.SaveBoardDoc(c.Context(), user.ID, id, doc); err != nil {
		return writeBoardError(c, err, "Не удалось сохранить доску")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"saved": true})
}

// DeleteBoard — доска удаляется вместе со сценой.
func DeleteBoard(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор доски", nil)
	}

	if err := db.DeleteBoard(c.Context(), user.ID, id); err != nil {
		return writeBoardError(c, err, "Не удалось удалить доску")
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Доска удалена"})
}

// boardFields проверяет название и видимость доски.
func boardFields(req models.BoardPayload) (string, string, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return "", "", errBoardTitleEmpty
	}

	visibility := req.Visibility
	if visibility == "" {
		visibility = models.VisibilityPrivate
	}
	if !visibility.Valid() {
		return "", "", errBoardVisibilityUnknown
	}

	return title, string(visibility), nil
}

// boardDoc превращает сцену в jsonb. Пустой объект тоже допустим: это новая доска.
func boardDoc(doc any) ([]byte, error) {
	if doc == nil {
		return []byte("{}"), nil
	}

	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}

	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return nil, err
	}

	return raw, nil
}

var (
	errBoardTitleEmpty        = errors.New("название доски не может быть пустым")
	errBoardVisibilityUnknown = errors.New("неизвестная видимость доски")
)

// writeBoardError переводит ошибки базы в ответы API: понятное сообщение вместо 500.
func writeBoardError(c *fiber.Ctx, err error, fallback string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation && pgErr.ConstraintName == boardTitleConflict {
		return utils.Fail(c, fiber.StatusConflict, "Доска с таким названием уже есть", nil)
	}

	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Доска не найдена", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}
