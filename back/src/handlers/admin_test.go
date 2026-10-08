package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

type adminAPIResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func adminPanelApp(admin *models.User) *fiber.App {
	app := fiber.New()
	app.Use(middlewares.RequireJSONBody)

	panel := app.Group("/admin", func(c *fiber.Ctx) error {
		c.Locals(middlewares.UserLocalKey, admin)
		return RequireAdmin(c)
	})
	panel.Get("/users", ListAdminUsers)
	panel.Post("/users/:id/block", BlockUser)
	panel.Post("/users/:id/unblock", UnblockUser)
	panel.Put("/users/:id/role", UpdateUserRole)
	panel.Get("/news", ListAdminNews)
	panel.Post("/news", CreateAdminNews)
	panel.Delete("/news/:id", DeleteAdminNews)
	panel.Get("/actions", ListAdminActions)

	app.Get("/news", ListNews)

	return app
}

func callAdminAPI(t *testing.T, app *fiber.App, method, path string, body any) (*http.Response, adminAPIResponse, string) {
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

	response, err := app.Test(request, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	raw, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	_ = response.Body.Close()

	var parsed adminAPIResponse
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &parsed)
	}
	return response, parsed, string(raw)
}

func createTestUser(t *testing.T, login, role string, blocked bool) *models.User {
	t.Helper()

	hashed, err := utils.HashPassword("sup3r-secret-password")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}

	user, err := db.CreateUser(context.Background(), &models.User{
		Login:    login,
		Email:    login + "@example.com",
		Password: hashed,
	})
	if err != nil {
		t.Fatalf("создание пользователя %s: %v", login, err)
	}

	if err := db.SetEmailVerified(context.Background(), user.ID); err != nil {
		t.Fatalf("подтверждение почты: %v", err)
	}
	if role != "" && role != models.RoleUser {
		if _, err := db.SetUserRole(context.Background(), user.ID, role); err != nil {
			t.Fatalf("роль: %v", err)
		}
	}
	if blocked {
		if _, err := db.SetUserBlocked(context.Background(), user.ID, true, "тестовая причина", 0); err != nil {
			t.Fatalf("блокировка: %v", err)
		}
	}

	fresh, err := db.GetUserById(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("перечитать пользователя: %v", err)
	}
	return fresh
}

func cleanupAdminUsers(t *testing.T, logins []string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, utils.Config().DBUrl)
	if err != nil {
		t.Logf("cleanup: %v", err)
		return
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `DELETE FROM admin_actions WHERE admin_login = ANY($1)`, logins); err != nil {
		t.Logf("cleanup actions: %v", err)
	}
	if _, err := conn.Exec(ctx, `DELETE FROM news WHERE title LIKE 'тест-%'`); err != nil {
		t.Logf("cleanup news: %v", err)
	}
	if _, err := conn.Exec(ctx, `DELETE FROM users WHERE login = ANY($1)`, logins); err != nil {
		t.Logf("cleanup users: %v", err)
	}
}
