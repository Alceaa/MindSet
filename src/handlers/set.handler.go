package handlers

import (
	"errors"
	"strings"
	"time"

	"mindset/db"
	"mindset/links"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const setTitleConflict = "sets_user_title_key_idx"

const (
	publicSetsPageSize    = 50
	publicSetsMaxPageSize = 100
	publicSearchMaxLength = 100
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

	set := &models.Set{
		UserID:       user.ID,
		Title:        strings.TrimSpace(req.Title),
		TitleKey:     links.NormalizeTitle(req.Title),
		Visibility:   visibilityOrDefault(req.Visibility),
		ForbidCopies: req.ForbidCopies,
		Description:  strings.TrimSpace(req.Description),
		Content:      req.Content,
	}
	parsed := links.Parse(req.Content)

	var created *models.Set
	err := db.WithTx(c.Context(), func(tx pgx.Tx) error {
		slug, txErr := db.ReserveSlug(c.Context(), tx, set.Title, 0)
		if txErr != nil {
			return txErr
		}
		set.Slug = slug

		var err error
		created, err = db.CreateSet(c.Context(), tx, set)
		if err != nil {
			return err
		}

		return db.ReplaceSetLinks(c.Context(), tx, created.ID, user.ID, parsed)
	})
	if err != nil {
		return writeSetError(c, err, "Не удалось создать сет")
	}

	setLinks, err := db.GetSetLinks(c.Context(), created.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Сет создан, но связи не загрузились", err)
	}

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"message": "Сет успешно создан",
		"set":     created,
		"links":   setLinks,
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

	setLinks, err := db.GetSetLinks(c.Context(), set.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить связи сета", err)
	}

	backlinks, err := db.GetBacklinks(c.Context(), set.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить обратные ссылки", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"set":       set,
		"links":     setLinks,
		"backlinks": backlinks,
	})
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

	existing, err := db.GetSetByID(c.Context(), id, user.ID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сет", err)
	}

	set := &models.Set{
		ID:           id,
		UserID:       user.ID,
		Title:        strings.TrimSpace(req.Title),
		TitleKey:     links.NormalizeTitle(req.Title),
		Slug:         existing.Slug,
		Visibility:   visibilityOrDefault(req.Visibility),
		ForbidCopies: req.ForbidCopies,
		Description:  strings.TrimSpace(req.Description),
		Content:      req.Content,
	}
	parsed := links.Parse(req.Content)

	var updated *models.Set
	err = db.WithTx(c.Context(), func(tx pgx.Tx) error {
		var txErr error
		updated, txErr = db.UpdateSet(c.Context(), tx, set)
		if txErr != nil {
			return txErr
		}

		if err := db.ReplaceSetLinks(c.Context(), tx, updated.ID, user.ID, parsed); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return writeSetError(c, err, "Не удалось сохранить сет")
	}

	setLinks, err := db.GetSetLinks(c.Context(), updated.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Сет сохранён, но связи не загрузились", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Сет сохранён",
		"set":     updated,
		"links":   setLinks,
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

	var req struct {
		ForbidCopies bool `json:"forbid_copies"`
	}
	var forbidCopies bool
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
		}
		forbidCopies = req.ForbidCopies
	}

	err = db.WithTx(c.Context(), func(tx pgx.Tx) error {
		existing, err := db.LockSetForDelete(c.Context(), tx, id, user.ID)
		if err != nil {
			return err
		}

		if forbidCopies || !existing.Visibility.ReadableByOthers() {
			if err := db.TombstoneSet(c.Context(), tx, existing, user.Login, forbidCopies); err != nil {
				return err
			}
		} else {
			deadline := time.Now().AddDate(0, 0, 30)
			tombstoneID, err := db.SetTombstone(c.Context(), tx, existing.ID, user.ID, deadline, false)
			if err != nil {
				return err
			}
			if err := db.FreezeSavedSets(c.Context(), tx, existing.ID); err != nil {
				return err
			}
			if err := db.LinkSavedSetsToTombstone(c.Context(), tx, existing.ID, tombstoneID); err != nil {
				return err
			}
		}

		return db.DeleteSetInTx(c.Context(), tx, id, user.ID)
	})
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось удалить сет", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет удалён"})
}

func GetPublicSets(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", publicSetsPageSize)
	offset := c.QueryInt("offset", 0)
	search := strings.TrimSpace(c.Query("q"))

	if limit <= 0 || limit > publicSetsMaxPageSize {
		limit = publicSetsPageSize
	}
	if offset < 0 {
		offset = 0
	}
	if runes := []rune(search); len(runes) > publicSearchMaxLength {
		search = string(runes[:publicSearchMaxLength])
	}

	viewerID := 0
	if viewer, ok := middlewares.CurrentUser(c); ok {
		viewerID = viewer.ID
	}

	sets, total, err := db.GetPublicSets(c.Context(), search, viewerID, limit, offset)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить публичные сеты", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"sets":     sets,
		"query":    search,
		"limit":    limit,
		"offset":   offset,
		"total":    total,
		"has_more": offset+len(sets) < total,
	})
}

func GetPublicSet(c *fiber.Ctx) error {
	slug := strings.TrimSpace(c.Params("slug"))
	if slug == "" || !links.IsValidSlug(slug) {
		return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
	}

	set, err := db.GetPublicSetBySlug(c.Context(), slug)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сет", err)
	}

	author, err := db.GetUserById(c.Context(), set.UserID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить автора сета", err)
	}
	set.Author = &models.SetAuthor{Login: author.Login}

	setLinks, err := db.GetPublicSetLinks(c.Context(), set.ID, set.UserID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить связи сета", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"set":   set,
		"links": setLinks,
	})
}

func visibilityOrDefault(value models.Visibility) models.Visibility {
	if !value.Valid() {
		return models.VisibilityPrivate
	}
	return value
}

func writeSetError(c *fiber.Ctx, err error, fallback string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation && pgErr.ConstraintName == setTitleConflict {
		return utils.Fail(c, fiber.StatusConflict, "Сет с таким названием уже есть", nil)
	}

	if errors.Is(err, db.ErrNotFound) {
		return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
	}

	return utils.Fail(c, fiber.StatusInternalServerError, fallback, err)
}

func GetSetCopyStats(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	setID, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", err)
	}

	if _, err := db.GetSetByID(c.Context(), setID, user.ID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось проверить сет", err)
	}

	copyCount, accountCount, err := db.GetSetCopyStats(c.Context(), setID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать статистику копий", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"copy_count":    copyCount,
		"account_count": accountCount,
	})
}

func GetSetTombstones(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	tombstones, err := db.GetSetTombstones(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить ярлыки удалений", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"tombstones": tombstones})
}

func ForbidSetTombstone(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	tombstoneID, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор ярлыка", err)
	}

	err = db.WithTx(c.Context(), func(tx pgx.Tx) error {
		return db.ForbidSetTombstone(c.Context(), tx, tombstoneID, user.ID)
	})
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Ярлык удаления не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось применить запрет на копии", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Запрет на копии применён"})
}
