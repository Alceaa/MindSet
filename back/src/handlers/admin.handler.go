package handlers

import (
	"errors"
	"log"
	"strings"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func RequireAdmin(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}
	if !user.IsAdmin() {
		return utils.Fail(c, fiber.StatusNotFound, "Маршрут не найден", nil)
	}
	return c.Next()
}

func recordAction(c *fiber.Ctx, action, targetType string, targetID int, details string) {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return
	}

	if err := db.RecordAdminAction(c.Context(), user.ID, user.Login, action, targetType, targetID, details); err != nil {
		log.Printf("[admin] действие %s не записано в журнал: %v", action, err)
	}
}

func requireAnotherAdmin(c *fiber.Ctx, message string) error {
	admins, err := db.CountAdmins(c.Context())
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}
	if admins <= 1 {
		if message == "" {
			message = "Это единственный администратор — действие запрещено"
		}
		return utils.Fail(c, fiber.StatusConflict, message, nil)
	}
	return nil
}

func ListAdminUsers(c *fiber.Ctx) error {
	users, err := db.ListAdminUsers(c.Context(),
		strings.TrimSpace(c.Query("q")),
		c.QueryBool("blocked", false),
		c.QueryInt("limit", 30),
		c.QueryInt("offset", 0),
	)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить пользователей", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"users": users})
}

func BlockUser(c *fiber.Ctx) error {
	admin, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор пользователя", err)
	}
	if id == admin.ID {
		return utils.Fail(c, fiber.StatusBadRequest, "Нельзя заблокировать себя", nil)
	}

	var req models.BlockUserPayload
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
		}
		if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
			return utils.FailValidation(c, validationErrors)
		}
	}

	target, err := db.GetUserById(c.Context(), id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if target.IsAdmin() {
		if err := requireAnotherAdmin(c, "Это единственный администратор — блокировка запрещена"); err != nil {
			return err
		}
	}

	reason := strings.TrimSpace(req.Reason)
	updated, err := db.SetUserBlocked(c.Context(), id, true, reason, admin.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось заблокировать пользователя", err)
	}

	recordAction(c, "block_user", "user", id, reason)

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Пользователь " + updated.Login + " заблокирован",
		"user":    updated.Public(),
	})
}

func UnblockUser(c *fiber.Ctx) error {
	admin, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор пользователя", err)
	}

	updated, err := db.SetUserBlocked(c.Context(), id, false, "", admin.ID)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось разблокировать пользователя", err)
	}

	recordAction(c, "unblock_user", "user", id, "")

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Пользователь " + updated.Login + " разблокирован",
		"user":    updated.Public(),
	})
}

func UpdateUserRole(c *fiber.Ctx) error {
	admin, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор пользователя", err)
	}

	var req models.RolePayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	if id == admin.ID && req.Role != models.RoleAdmin {
		return utils.Fail(c, fiber.StatusBadRequest, "Нельзя снять роль администратора с себя", nil)
	}

	target, err := db.GetUserById(c.Context(), id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Пользователь не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Ошибка сервера, повторите позже", err)
	}

	if target.IsAdmin() && req.Role != models.RoleAdmin {
		if err := requireAnotherAdmin(c, "Это единственный администратор — роль снять нельзя"); err != nil {
			return err
		}
	}

	updated, err := db.SetUserRole(c.Context(), id, req.Role)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось изменить роль", err)
	}

	recordAction(c, "set_role", "user", id, req.Role)

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Роль пользователя " + updated.Login + " обновлена",
		"user":    updated.Public(),
	})
}

func ListAdminActions(c *fiber.Ctx) error {
	actions, err := db.ListAdminActions(c.Context(), c.QueryInt("limit", 50))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить журнал", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"actions": actions})
}
