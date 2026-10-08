package routes

import (
	"strings"
	"testing"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestEmailVerificationFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := uniqueTestLogin(t, "verify")
	email := login + "@example.com"
	password := "sup3r-secret-password"
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	resp, _, raw := registerUser(t, app, login, email, password)
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("регистрация = %d, ожидалось 202: %s", resp.StatusCode, raw)
	}
	if !strings.Contains(raw, email) {
		t.Fatalf("в ответе регистрации нет адреса: %s", raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusUnauthorized || !strings.Contains(raw, "не активирован") {
		t.Fatalf("вход до подтверждения = %d (%s)", resp.StatusCode, raw)
	}

	token := readVerificationToken(t)

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email",
		Body:   map[string]string{"token": token},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("подтверждение почты = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.Login != login || !body.User.EmailVerified {
		t.Fatalf("аккаунт создан неверно: %s", raw)
	}
	if len(resp.Cookies()) == 0 {
		t.Fatalf("после подтверждения должна открываться сессия")
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email",
		Body:   map[string]string{"token": token},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("повторное использование ссылки = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	_, me, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/auth/me",
		Cookies: loginCookies(t, app, login, password),
	})
	if me.User == nil || !me.User.EmailVerified {
		t.Fatalf("в /auth/me почта не подтверждена: %s", raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/auth/verify-email/request",
		Cookies: loginCookies(t, app, login, password),
		Body:    map[string]string{"email": email},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("повторная отправка для подтверждённого адреса = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email/request",
		Body:   map[string]string{"email": "nobody_" + email},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("запрос для чужого адреса = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	resp, _, raw = registerUser(t, app, login, email, password)
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("регистрация занятого логина = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}
}

func TestPendingRegistrationKeepsOriginalPassword(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := uniqueTestLogin(t, "pending")
	email := login + "@example.com"
	password := "sup3r-secret-password"
	otherLogin := uniqueTestLogin(t, "other")
	otherPassword := "another-secret-password"
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login, otherLogin}) })

	resp, _, raw := registerUser(t, app, login, email, password)
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("регистрация = %d, ожидалось 202: %s", resp.StatusCode, raw)
	}
	firstToken := readVerificationToken(t)

	resp, _, raw = registerUser(t, app, otherLogin, email, otherPassword)
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("повторная заявка на тот же адрес = %d, ожидалось 202: %s", resp.StatusCode, raw)
	}
	secondToken := readVerificationToken(t)

	if firstToken == secondToken {
		t.Fatal("повторная отправка должна выпускать новую ссылку")
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email",
		Body:   map[string]string{"token": firstToken},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("прежняя ссылка должна перестать работать: %d (%s)", resp.StatusCode, raw)
	}

	verifyEmail(t, app, secondToken)

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": otherLogin, "password": otherPassword},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("подменённый логин не должен появиться: %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход с исходным паролем = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
}
