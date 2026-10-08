package routes

import (
	"testing"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestPasswordResetFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := uniqueTestLogin(t, "reset")
	email := login + "@example.com"
	oldPassword := "sup3r-secret-password"
	newPassword := "even-better-password"
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	registerVerified(t, app, login, email, oldPassword)
	incomingMail(t).reset()

	resp, unknown, _ := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/forgot",
		Body:   map[string]string{"email": "nobody_" + email},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("запрос для чужого адреса = %d, ожидалось 200", resp.StatusCode)
	}

	resp, known, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/forgot",
		Body:   map[string]string{"email": email},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("запрос сброса = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if known.Message != unknown.Message {
		t.Fatalf("ответ выдаёт существование адреса: %q != %q", known.Message, unknown.Message)
	}

	token := linkToken(t, incomingMail(t).last(t), "/reset")

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/reset",
		Body:   map[string]string{"token": token, "password": "short", "password_confirm": "short"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("короткий пароль = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/reset",
		Body:   map[string]string{"token": token, "password": newPassword, "password_confirm": newPassword + "x"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("несовпадающие пароли = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/reset",
		Body:   map[string]string{"token": token, "password": newPassword, "password_confirm": newPassword},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сброс пароля = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/reset",
		Body:   map[string]string{"token": token, "password": newPassword, "password_confirm": newPassword},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("повторный сброс по той же ссылке = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": oldPassword},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("вход со старым паролем = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": newPassword},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход с новым паролем = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
}
