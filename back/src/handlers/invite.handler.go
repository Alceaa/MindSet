package handlers

import (
	"errors"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"mindset/db"
	"mindset/mailer"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

var (
	errInviteRequired = errors.New("invite required")
	errInviteInvalid  = errors.New("invite invalid")
)

var (
	settingsOnce  sync.Once
	adminToken    string
	inviteOnly    bool
	inviteTTLDays int
)

func loadSettings() {
	settingsOnce.Do(func() {
		cfg := utils.Config()
		adminToken = cfg.AdminToken
		inviteOnly = cfg.RegistrationInviteOnly
		inviteTTLDays = cfg.InviteTTLDays
	})
}

func RequireAdminToken(c *fiber.Ctx) error {
	loadSettings()

	expected := strings.TrimSpace(adminToken)
	if expected == "" {
		return utils.Fail(c, fiber.StatusNotFound, "Маршрут не найден", nil)
	}

	provided := strings.TrimSpace(c.Get("X-Admin-Token"))
	if provided == "" {
		provided = strings.TrimSpace(strings.TrimPrefix(c.Get(fiber.HeaderAuthorization), "Bearer "))
	}

	if provided != "" {
		if provided == expected {
			return c.Next()
		}
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется токен администратора", nil)
	}

	if user, ok := middlewares.CurrentUser(c); ok && user.IsAdmin() {
		return c.Next()
	}

	if c.Cookies(utils.AccessTokenCookie) != "" {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	return utils.Fail(c, fiber.StatusNotFound, "Маршрут не найден", nil)
}

func resolveInvite(c *fiber.Ctx, token string) (int, error) {
	loadSettings()

	if !inviteOnly {
		return 0, nil
	}

	token = strings.TrimSpace(token)
	if token == "" {
		return 0, errInviteRequired
	}

	invite, err := db.GetActiveInviteByToken(c.Context(), mailer.HashToken(token))
	switch {
	case errors.Is(err, db.ErrNotFound):
		return 0, errInviteInvalid
	case err != nil:
		return 0, err
	}
	return invite.ID, nil
}

func CreateInvite(c *fiber.Ctx) error {
	loadSettings()

	var req models.InvitePayload

	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	days := req.Days
	if days <= 0 {
		days = inviteTTLDays
	}

	token, tokenHash, err := mailer.NewToken()
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать приглашение", err)
	}

	createdBy := 0
	if user, ok := middlewares.CurrentUser(c); ok {
		createdBy = user.ID
	}

	ttl := time.Duration(days) * 24 * time.Hour
	invite, err := db.CreateInvite(c.Context(), tokenHash, strings.TrimSpace(req.Note), createdBy, int(ttl.Seconds()))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось создать приглашение", err)
	}
	_, _ = db.DeleteExpiredInvites(c.Context())

	return utils.Success(c, fiber.StatusCreated, fiber.Map{
		"invite": invite,
		"url":    inviteLink(c, token),
	})
}

func ListInvites(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit"))

	invites, err := db.ListInvites(c.Context(), limit)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить приглашения", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"invites": invites})
}

func RevokeInvite(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор приглашения", err)
	}

	err = db.DeleteInvite(c.Context(), id)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Приглашение не найдено или уже использовано", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отозвать приглашение", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Приглашение отозвано"})
}

func RegistrationConfig(c *fiber.Ctx) error {
	loadSettings()

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"invite_only":       inviteOnly,
		"registration_open": !inviteOnly,
	})
}

func inviteLink(c *fiber.Ctx, token string) string {
	return utils.Config().BaseURL() + "/signup?invite=" + url.QueryEscape(token)
}
