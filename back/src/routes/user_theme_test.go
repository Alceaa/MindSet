package routes

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// Своя тема оформления: восемь ролей в профиле, без модерации и без каталога.
type apiUserTheme struct {
	Title string            `json:"title"`
	Mode  string            `json:"mode"`
	Base  string            `json:"base"`
	Roles map[string]string `json:"roles"`
}

type userThemeResponse struct {
	Status string        `json:"status"`
	Theme  *apiUserTheme `json:"theme"`
}

func decodeUserTheme(t *testing.T, raw string) *apiUserTheme {
	t.Helper()

	var parsed userThemeResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("ответ не разобран: %v (%s)", err, raw)
	}

	return parsed.Theme
}

func TestUserThemeLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	login := fmt.Sprintf("ut_%d", time.Now().UnixNano())
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	cookies := registerVerified(t, app, login, login+"@example.com", "sup3r-secret-password")

	resp, _, _ := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/users/me/theme"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("своя тема без сессии = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/users/me/theme", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("чтение своей темы = %d (%s)", resp.StatusCode, raw)
	}
	if decodeUserTheme(t, raw) != nil {
		t.Errorf("до сохранения темы быть не должно: %s", raw)
	}

	badRole := map[string]any{
		"mode": "dark", "base": "dark",
		"roles": map[string]string{"--shadow": "#000000"},
	}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: "/users/me/theme", Cookies: cookies, Body: badRole,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("незнакомая роль = %d (%s), ожидалось 400", resp.StatusCode, raw)
	}

	badColor := map[string]any{
		"mode": "dark", "base": "dark",
		"roles": map[string]string{"text": "red"},
	}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: "/users/me/theme", Cookies: cookies, Body: badColor,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("цвет не вида #rrggbb = %d (%s), ожидалось 400", resp.StatusCode, raw)
	}

	theme := map[string]any{
		"title": "Моя тема",
		"mode":  "dark",
		"base":  "dark",
		"roles": map[string]string{"canvas": "#101216", "accent": "#9DB4D0"},
	}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: "/users/me/theme", Cookies: cookies, Body: theme,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сохранение своей темы = %d (%s)", resp.StatusCode, raw)
	}
	saved := decodeUserTheme(t, raw)
	if saved == nil || saved.Title != "Моя тема" || saved.Mode != "dark" || saved.Base != "dark" {
		t.Fatalf("сохранённая тема = %+v", saved)
	}
	if saved.Roles["accent"] != "#9db4d0" {
		t.Errorf("цвет роли не нормализован: %q", saved.Roles["accent"])
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/users/me/theme", Cookies: cookies,
	})
	restored := decodeUserTheme(t, raw)
	if resp.StatusCode != fiber.StatusOK || restored == nil || restored.Roles["canvas"] != "#101216" {
		t.Fatalf("тема не вернулась из профиля: %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodDelete, Path: "/users/me/theme", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сброс своей темы = %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/users/me/theme", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK || decodeUserTheme(t, raw) != nil {
		t.Errorf("после сброса тема должна исчезнуть: %s", raw)
	}
}
