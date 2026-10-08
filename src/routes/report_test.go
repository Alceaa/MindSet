package routes

import (
	"testing"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestBugReportEndpoint(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := uniqueTestLogin(t, "report")
	email := login + "@example.com"
	password := "sup3r-secret-password"
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/reports",
		Body: map[string]string{
			"topic":   "Не сохраняется биография",
			"message": "Открыл настройки, ввёл текст, нажал сохранить — ничего не произошло.",
			"page":    "/settings",
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("отчёт анонима = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}

	authCookies := registerVerified(t, app, login, email, password)

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/reports",
		Cookies: authCookies,
		Body: map[string]string{
			"topic":   "Ошибка в редакторе",
			"message": "При вставке картинки редактор падает с ошибкой на пустом сете.",
			"page":    "/sets/12",
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("отчёт пользователя = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/reports",
		Body:   map[string]string{"topic": "ok", "message": "мало"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("короткие поля = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}
	for _, field := range []string{"topic", "message"} {
		if !containsField(body.Errors, field) {
			t.Errorf("нет ошибки валидации для %s: %+v", field, body.Errors)
		}
	}
}
