package routes

import (
	"testing"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func wrongCodeFor(code string) string {
	if code == "000000" {
		return "111111"
	}
	return "000000"
}

func TestTwoFactorLoginFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := uniqueTestLogin(t, "twofa")
	email := login + "@example.com"
	password := "sup3r-secret-password"
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	authCookies := registerVerified(t, app, login, email, password)
	incomingMail(t).reset()

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход без кода = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.TwoFactorEmail {
		t.Fatalf("вход по коду должен быть выключен по умолчанию: %s", raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/2fa",
		Cookies: authCookies,
		Body:    map[string]any{"enabled": true, "password": "wrong-password"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("включение с неверным паролем = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/2fa",
		Cookies: authCookies,
		Body:    map[string]any{"enabled": true, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK || body.User == nil || !body.User.TwoFactorEmail {
		t.Fatalf("включение входа по коду = %d: %s", resp.StatusCode, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusAccepted || !body.TwoFactorRequired {
		t.Fatalf("вход с кодом = %d, ожидалось 202 и запрос кода: %s", resp.StatusCode, raw)
	}

	preAuth, _, _ := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/auth/me",
		Cookies: resp.Cookies(),
	})
	if preAuth.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("до ввода кода доступ выдаваться не должен: %d", preAuth.StatusCode)
	}

	code := readLoginCode(t)

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": wrongCodeFor(code)},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("неверный код = %d, ожидалось 401: %s", resp.StatusCode, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": code},
	})
	if resp.StatusCode != fiber.StatusOK || body.User == nil {
		t.Fatalf("подтверждение входа = %d: %s", resp.StatusCode, raw)
	}
	if len(resp.Cookies()) == 0 {
		t.Fatalf("после подтверждения кода должна выдаваться сессия")
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": code},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("повторное использование кода = %d, ожидалось 401: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("повторный вход с кодом = %d, ожидалось 202: %s", resp.StatusCode, raw)
	}
	freshCode := readLoginCode(t)

	for attempt := 0; attempt < 5; attempt++ {
		resp, _, _ = call(t, app, callOptions{
			Method: fiber.MethodPost,
			Path:   "/auth/login/confirm",
			Body:   map[string]string{"login": login, "password": password, "code": wrongCodeFor(freshCode)},
		})
		if resp.StatusCode != fiber.StatusUnauthorized {
			t.Fatalf("неверный код = %d, ожидалось 401", resp.StatusCode)
		}
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": freshCode},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("после пяти ошибок код должен быть погашен: %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": "12"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("код неверной длины = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/2fa",
		Cookies: authCookies,
		Body:    map[string]any{"enabled": false, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK || body.User == nil || body.User.TwoFactorEmail {
		t.Fatalf("выключение входа по коду = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход после выключения кода = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login/confirm",
		Body:   map[string]string{"login": login, "password": password, "code": freshCode},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("подтверждение при выключенном коде = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}
}
