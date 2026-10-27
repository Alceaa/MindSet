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
	"github.com/jackc/pgx/v5"
)

const feedPageSize = 12

// Сколько закреплённых новостей максимум отдаём в ленту обзора: остальные — на странице /news.
const feedPinnedNewsLimit = 12

func resolvePublicSet(c *fiber.Ctx) (*models.Set, bool) {
	slug := strings.TrimSpace(c.Params("slug"))
	if slug == "" || !links.IsValidSlug(slug) {
		_ = utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		return nil, false
	}

	set, err := db.GetPublicSetBySlug(c.Context(), slug)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			_ = utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		} else {
			_ = utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сет", err)
		}
		return nil, false
	}
	return set, true
}

func LikeSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	set, ok := resolvePublicSet(c)
	if !ok {
		return nil
	}

	err := db.WithTx(c.Context(), func(tx pgx.Tx) error {
		created, txErr := db.SetLike(c.Context(), tx, set.ID, user.ID)
		if txErr != nil {
			return txErr
		}
		if !created {
			return nil
		}

		return notifyRecipient(c.Context(), tx, &models.Notification{
			UserID:     set.UserID,
			Kind:       models.NotificationSetLike,
			ActorID:    user.ID,
			ActorLogin: user.Login,
			SetID:      set.ID,
			SetSlug:    set.Slug,
			SetTitle:   set.Title,
		})
	})
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось поставить лайк", err)
	}

	liked, count, err := db.LikeState(c.Context(), set.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Лайк поставлен, но счётчик не загрузился", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"liked": liked, "count": count})
}

func UnlikeSet(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	set, ok := resolvePublicSet(c)
	if !ok {
		return nil
	}

	if err := db.SetUnlike(c.Context(), set.ID, user.ID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось убрать лайк", err)
	}

	liked, count, err := db.LikeState(c.Context(), set.ID, user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Лайк убран, но счётчик не загрузился", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"liked": liked, "count": count})
}

func GetSetLikes(c *fiber.Ctx) error {
	set, ok := resolvePublicSet(c)
	if !ok {
		return nil
	}

	viewerID := 0
	if viewer, ok := middlewares.CurrentUser(c); ok {
		viewerID = viewer.ID
	}

	liked, count, err := db.LikeState(c.Context(), set.ID, viewerID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить лайки", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"liked": liked, "count": count})
}

func ListSetComments(c *fiber.Ctx) error {
	set, ok := resolvePublicSet(c)
	if !ok {
		return nil
	}

	comments, err := db.ListComments(c.Context(), set.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить комментарии", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"comments": comments})
}

func CreateComment(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	set, ok := resolvePublicSet(c)
	if !ok {
		return nil
	}

	var req models.CommentPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	var comment *models.Comment
	err := db.WithTx(c.Context(), func(tx pgx.Tx) error {
		created, txErr := db.CreateComment(c.Context(), tx, set.ID, user.ID, strings.TrimSpace(req.Body))
		if txErr != nil {
			return txErr
		}
		comment = created

		return notifyRecipient(c.Context(), tx, &models.Notification{
			UserID:     set.UserID,
			Kind:       models.NotificationSetComment,
			ActorID:    user.ID,
			ActorLogin: user.Login,
			SetID:      set.ID,
			SetSlug:    set.Slug,
			SetTitle:   set.Title,
			Excerpt:    strings.TrimSpace(req.Body),
		})
	})
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось добавить комментарий", err)
	}
	comment.Login = user.Login
	comment.Avatar = user.Avatar

	return utils.Success(c, fiber.StatusCreated, fiber.Map{"comment": comment})
}

func DeleteComment(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	commentID, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор комментария", err)
	}

	if err := db.DeleteComment(c.Context(), commentID, user.ID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Комментарий не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось удалить комментарий", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Комментарий удалён"})
}

func GetFeed(c *fiber.Ctx) error {
	viewerID := 0
	if viewer, ok := middlewares.CurrentUser(c); ok {
		viewerID = viewer.ID
	}

	announcements, err := db.ListFeedAnnouncements(c.Context(), feedPinnedNewsLimit)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить новости проекта", err)
	}

	following := []*models.Set{}
	if viewerID > 0 {
		following, err = db.FeedFollowingSets(c.Context(), viewerID, feedPageSize)
		if err != nil {
			return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить ленту подписок", err)
		}
	}

	popular, err := db.FeedPopularSets(c.Context(), viewerID, feedPageSize)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить популярные сеты", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"announcements": announcements,
		"following":     following,
		"popular":       popular,
	})
}
