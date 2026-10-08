package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mindset/db"
	"mindset/mailer"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

const testAdminToken = "test-admin-token"

type inviteAPIResponse struct {
	Status           string `json:"status"`
	Message          string `json:"message"`
	URL              string `json:"url"`
	InviteOnly       bool   `json:"invite_only"`
	RegistrationOpen bool   `json:"registration_open"`
	Invite           *struct {
		ID   int    `json:"id"`
		Note string `json:"note"`
		Used bool   `json:"used"`
	} `json:"invite"`
	Invites []struct {
		ID   int  `json:"id"`
		Used bool `json:"used"`
	} `json:"invites"`
}

func TestMain(m *testing.M) {
	_ = os.Setenv("ENV_FILE", filepath.Join("..", ".env"))
	mailer.Setup(mailer.Config{})

	cfg := utils.Config()
	if err := db.Open(cfg.DBUrl); err != nil {
		fmt.Fprintf(os.Stderr, "БД недоступна (%v), тесты handlers пропущены\n", err)
		os.Exit(0)
	}

	loadSettings()
	adminToken = testAdminToken

	code := m.Run()
	db.Close()
	os.Exit(code)
}

func inviteApp() *fiber.App {
	app := fiber.New()
	app.Use(middlewares.RequireJSONBody)
	app.Get("/auth/config", RegistrationConfig)
	app.Post("/auth/register", Register)

	admin := app.Group("/admin", RequireAdminToken)
	admin.Post("/invites", CreateInvite)
	admin.Get("/invites", ListInvites)

	return app
}

func callInviteAPI(t *testing.T, app *fiber.App, method, path, token string, body any) (*http.Response, inviteAPIResponse, string) {
	t.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	request := httptest.NewRequest(method, path, reader)
	if body != nil {
		request.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	}
	if token != "" {
		request.Header.Set("X-Admin-Token", token)
	}

	response, err := app.Test(request, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	raw, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	_ = response.Body.Close()

	var parsed inviteAPIResponse
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &parsed)
	}
	return response, parsed, string(raw)
}

func inviteTokenFromURL(t *testing.T, url string) string {
	t.Helper()

	idx := strings.Index(url, "?invite=")
	if idx < 0 {
		t.Fatalf("в ссылке нет приглашения: %s", url)
	}
	return url[idx+len("?invite="):]
}

func cleanupInvites(t *testing.T, notePrefix string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, utils.Config().DBUrl)
	if err != nil {
		t.Logf("cleanup: %v", err)
		return
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `DELETE FROM invites WHERE note LIKE $1`, notePrefix+"%"); err != nil {
		t.Logf("cleanup invites: %v", err)
	}
	if _, err := conn.Exec(ctx, `DELETE FROM users WHERE login LIKE 'invite\_%'`); err != nil {
		t.Logf("cleanup users: %v", err)
	}
	if _, err := conn.Exec(ctx, `DELETE FROM pending_registrations WHERE lower(login) LIKE 'invite\_%'`); err != nil {
		t.Logf("cleanup pending: %v", err)
	}
}

func registrationBody(login, email, invite string) map[string]string {
	return map[string]string{
		"login":            login,
		"email":            email,
		"password":         "sup3r-secret-password",
		"password_confirm": "sup3r-secret-password",
		"invite":           invite,
	}
}

func TestInviteOnlyRegistrationRequiresInvite(t *testing.T) {
	app := inviteApp()

	wasInviteOnly := inviteOnly
	inviteOnly = true
	t.Cleanup(func() {
		inviteOnly = wasInviteOnly
		cleanupInvites(t, "test-invite")
	})

	suffix := time.Now().UnixNano()

	response, _, raw := callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_a_%d", suffix),
		fmt.Sprintf("invite_a_%d@example.com", suffix),
		"",
	))
	if response.StatusCode != fiber.StatusForbidden {
		t.Fatalf("регистрация без приглашения = %d, ожидалось 403: %s", response.StatusCode, raw)
	}
	if !strings.Contains(raw, "приглашени") {
		t.Fatalf("в ответе нет упоминания приглашения: %s", raw)
	}

	response, created, raw := callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", testAdminToken, map[string]string{
		"note": fmt.Sprintf("test-invite-%d", suffix),
	})
	if response.StatusCode != fiber.StatusCreated || created.Invite == nil {
		t.Fatalf("создание приглашения = %d: %s", response.StatusCode, raw)
	}

	inviteToken := inviteTokenFromURL(t, created.URL)
	if len(inviteToken) != 64 {
		t.Fatalf("токен приглашения неверной длины: %q", inviteToken)
	}

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_b_%d", suffix),
		fmt.Sprintf("invite_b_%d@example.com", suffix),
		inviteToken,
	))
	if response.StatusCode != fiber.StatusAccepted {
		t.Fatalf("регистрация по приглашению = %d, ожидалось 202: %s", response.StatusCode, raw)
	}

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_c_%d", suffix),
		fmt.Sprintf("invite_c_%d@example.com", suffix),
		inviteToken,
	))
	if response.StatusCode != fiber.StatusForbidden {
		t.Fatalf("повторное использование приглашения = %d, ожидалось 403: %s", response.StatusCode, raw)
	}

	response, list, raw := callInviteAPI(t, app, fiber.MethodGet, "/admin/invites", testAdminToken, nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("список приглашений = %d: %s", response.StatusCode, raw)
	}

	found := false
	for _, item := range list.Invites {
		if item.ID == created.Invite.ID {
			found = true
			if !item.Used {
				t.Error("использованное приглашение помечено активным")
			}
		}
	}
	if !found {
		t.Fatalf("приглашение %d не найдено в списке: %s", created.Invite.ID, raw)
	}
}

func TestInviteRegistrationKeepsInviteOnValidationError(t *testing.T) {
	app := inviteApp()

	wasInviteOnly := inviteOnly
	inviteOnly = true
	t.Cleanup(func() {
		inviteOnly = wasInviteOnly
		cleanupInvites(t, "test-keep")
	})

	suffix := time.Now().UnixNano()

	response, created, raw := callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", testAdminToken, map[string]string{
		"note": fmt.Sprintf("test-keep-%d", suffix),
	})
	if response.StatusCode != fiber.StatusCreated || created.Invite == nil {
		t.Fatalf("создание приглашения = %d: %s", response.StatusCode, raw)
	}
	inviteToken := inviteTokenFromURL(t, created.URL)

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", map[string]string{
		"login":            "ab",
		"email":            "not-an-email",
		"password":         "123",
		"password_confirm": "456",
		"invite":           inviteToken,
	})
	if response.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("невалидная регистрация = %d, ожидалось 400: %s", response.StatusCode, raw)
	}

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_d_%d", suffix),
		fmt.Sprintf("invite_d_%d@example.com", suffix),
		inviteToken,
	))
	if response.StatusCode != fiber.StatusAccepted {
		t.Fatalf("приглашение должно остаться рабочим после ошибки валидации, получено %d: %s", response.StatusCode, raw)
	}
}

func TestAdminInvitesRequireToken(t *testing.T) {
	app := inviteApp()

	response, _, _ := callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", "", map[string]string{"note": "test-admin"})
	if response.StatusCode != fiber.StatusNotFound {
		t.Fatalf("без токена и сессии = %d, ожидалось 404 (маршрут скрыт)", response.StatusCode)
	}

	response, _, _ = callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", "wrong-token", map[string]string{"note": "test-admin"})
	if response.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("неверный токен = %d, ожидалось 401", response.StatusCode)
	}

	response, created, raw := callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", testAdminToken, map[string]string{"note": "test-admin-ok"})
	if response.StatusCode != fiber.StatusCreated || created.Invite == nil {
		t.Fatalf("верный токен = %d: %s", response.StatusCode, raw)
	}
	t.Cleanup(func() { cleanupInvites(t, "test-admin") })
}

func TestRegistrationConfigReflectsMode(t *testing.T) {
	app := inviteApp()

	wasInviteOnly := inviteOnly
	t.Cleanup(func() { inviteOnly = wasInviteOnly })

	inviteOnly = true
	_, closed, _ := callInviteAPI(t, app, fiber.MethodGet, "/auth/config", "", nil)
	if !closed.InviteOnly || closed.RegistrationOpen {
		t.Fatalf("в режиме приглашений конфиг неверный: %+v", closed)
	}

	inviteOnly = false
	_, open, raw := callInviteAPI(t, app, fiber.MethodGet, "/auth/config", "", nil)
	if open.InviteOnly || !open.RegistrationOpen {
		t.Fatalf("в открытом режиме конфиг неверный: %s", raw)
	}
}

func TestInviteStaysUsableWhenEmailFails(t *testing.T) {
	app := inviteApp()

	wasInviteOnly := inviteOnly
	inviteOnly = true
	t.Cleanup(func() {
		inviteOnly = wasInviteOnly
		mailer.Setup(mailer.Config{})
		cleanupInvites(t, "test-mail")
	})

	suffix := time.Now().UnixNano()

	response, created, raw := callInviteAPI(t, app, fiber.MethodPost, "/admin/invites", testAdminToken, map[string]string{
		"note": fmt.Sprintf("test-mail-%d", suffix),
	})
	if response.StatusCode != fiber.StatusCreated || created.Invite == nil {
		t.Fatalf("создание приглашения = %d: %s", response.StatusCode, raw)
	}
	inviteToken := inviteTokenFromURL(t, created.URL)

	mailer.Setup(mailer.Config{Host: "127.0.0.1", Port: 1, From: "MindSet <no-reply@test.local>", TLS: "none"})

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_m_%d", suffix),
		fmt.Sprintf("invite_m_%d@example.com", suffix),
		inviteToken,
	))
	if response.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("при недоступном SMTP ожидалась 500, получено %d: %s", response.StatusCode, raw)
	}

	mailer.Setup(mailer.Config{})

	response, _, raw = callInviteAPI(t, app, fiber.MethodPost, "/auth/register", "", registrationBody(
		fmt.Sprintf("invite_n_%d", suffix),
		fmt.Sprintf("invite_n_%d@example.com", suffix),
		inviteToken,
	))
	if response.StatusCode != fiber.StatusAccepted {
		t.Fatalf("после сбоя почты приглашение должно остаться рабочим, получено %d: %s", response.StatusCode, raw)
	}
}
