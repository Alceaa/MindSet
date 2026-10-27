package handlers

import (
	"context"
	"errors"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// notifyRecipient пишет уведомление получателю: пропускает свои же действия
// и уважает настройки категории (логика в слое БД — её использует и регистрация по инвайту).
func notifyRecipient(ctx context.Context, tx pgx.Tx, notification *models.Notification) error {
	return db.NotifyRecipient(ctx, tx, notification)
}

func ListNotifications(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)

	items, err := db.ListNotifications(c.Context(), user.ID, limit, offset)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить уведомления", err)
	}

	unread, err := db.UnreadNotificationCount(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать непрочитанные", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"notifications": items,
		"unread":        unread,
		"has_more":      len(items) >= limit,
	})
}

func UnreadNotifications(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	unread, err := db.UnreadNotificationCount(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать непрочитанные", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"unread": unread})
}

func MarkNotificationRead(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор уведомления", err)
	}

	err = db.MarkNotificationRead(c.Context(), user.ID, id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Уведомление не найдено", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отметить уведомление", err)
	}

	unread, err := db.UnreadNotificationCount(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось посчитать непрочитанные", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"unread": unread})
}

func MarkAllNotificationsRead(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	if err := db.MarkAllNotificationsRead(c.Context(), user.ID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отметить уведомления", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"unread": 0})
}

func GetNotificationPrefs(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	prefs, err := db.NotificationPrefs(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить настройки уведомлений", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"kinds": models.NotificationKinds,
		"prefs": prefs,
	})
}

func UpdateNotificationPrefs(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.NotificationPrefsPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	prefs, err := db.SetNotificationPref(
		c.Context(),
		user.ID,
		models.NormalizeKind(req.Kind),
		req.Enabled,
	)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить настройки уведомлений", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"prefs": prefs})
}
