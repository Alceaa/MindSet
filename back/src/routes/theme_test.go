package routes

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func themeDraft(key string) map[string]any {
	return map[string]any{
		"key":         key,
		"title":       "Тёплый вечер",
		"description": "Свой вариант тёмной темы",
		"mode":        "dark",
		"base":        "dark",
		"variables": map[string]string{
			"--bg-canvas": "#141018",
			"--accent":    "rgba(240, 180, 120, 0.9)",
		},
	}
}

func TestThemePackageLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("th_%d", suffix)
	otherLogin := fmt.Sprintf("th_other_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{authorLogin, otherLogin}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, authorLogin, authorLogin+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	resp, _, _ := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/theme-packages"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("свои темы без сессии = %d, ожидалось 401", resp.StatusCode)
	}

	key := fmt.Sprintf("theme-%d", suffix)

	// Ключ не задаём и не проверяем: он собирается из названия («Тёплый вечер» →
	// teplyy-vecher), а занятый ключ база заменит следующим свободным.
	first := themeDraft("")
	first["key"] = "Плохой ключ"
	resp, firstBody, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: first,
	})
	if resp.StatusCode != fiber.StatusCreated || firstBody.Theme == nil {
		t.Fatalf("создание темы без ключа = %d (%s)", resp.StatusCode, raw)
	}
	if !strings.HasPrefix(firstBody.Theme.Key, "teplyy-vecher") {
		t.Errorf("ключ темы = %q, ожидался собранный из названия", firstBody.Theme.Key)
	}

	second := themeDraft("")
	resp, secondBody, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: second,
	})
	if resp.StatusCode != fiber.StatusCreated || secondBody.Theme == nil {
		t.Fatalf("вторая тема с тем же названием = %d (%s)", resp.StatusCode, raw)
	}
	if secondBody.Theme.Key == firstBody.Theme.Key {
		t.Errorf("две темы с одним названием получили одинаковый ключ: %q", secondBody.Theme.Key)
	}

	unknown := themeDraft(key)
	unknown["variables"] = map[string]string{"--shadow": "#000000"}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: unknown,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("сложная переменная = %d (%s), ожидалось 400", resp.StatusCode, raw)
	}

	badColor := themeDraft(key)
	badColor["variables"] = map[string]string{"--accent": "url(https://example.com/x.png)"}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: badColor,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("значение с url() = %d (%s), ожидалось 400", resp.StatusCode, raw)
	}

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание темы = %d (%s), ожидалось 201", resp.StatusCode, raw)
	}
	if body.Theme == nil || body.Theme.ID == 0 {
		t.Fatalf("ответ создания без темы: %s", raw)
	}
	if body.Theme.Status != "draft" {
		t.Errorf("статус новой темы %q, ожидался draft", body.Theme.Status)
	}
	if body.Theme.Author != authorLogin {
		t.Errorf("автор темы %q, ожидался %q", body.Theme.Author, authorLogin)
	}
	if body.Theme.Variables["--bg-canvas"] != "#141018" {
		t.Errorf("переменные не сохранились: %+v", body.Theme.Variables)
	}

	themeID := body.Theme.ID

	resp, list, raw := call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/theme-packages", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK || len(list.Themes) != 1 {
		t.Fatalf("свои темы = %d (%s), ожидалась одна", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("повтор ключа = %d (%s), ожидалось 409", resp.StatusCode, raw)
	}

	resp, published, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes"})
	if resp.StatusCode != fiber.StatusOK || len(published.Themes) != 0 {
		t.Errorf("черновик попал в опубликованные: %d (%s)", resp.StatusCode, raw)
	}

	for _, request := range []callOptions{
		{Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: otherCookies, Body: themeDraft(key)},
		{Method: fiber.MethodDelete, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: otherCookies},
		{Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/submit", themeID), Cookies: otherCookies},
	} {
		resp, _, _ = call(t, app, request)
		if resp.StatusCode != fiber.StatusNotFound {
			t.Errorf("чужая операция %s %s = %d, ожидалось 404", request.Method, request.Path, resp.StatusCode)
		}
	}
}

func TestThemeModerationFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("thm_%d", suffix)
	otherLogin := fmt.Sprintf("thm_other_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{authorLogin, otherLogin}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, authorLogin, authorLogin+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	key := fmt.Sprintf("mod-%d", suffix)

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil {
		t.Fatalf("создание темы = %d (%s)", resp.StatusCode, raw)
	}
	themeID := body.Theme.ID
	themeKey := body.Theme.Key

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/submit", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme.Status != "pending" {
		t.Fatalf("отправка на модерацию = %d (%s), ожидался статус pending", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/themes",
	})
	if resp.StatusCode != fiber.StatusOK || len(body.Themes) != 0 {
		t.Errorf("тема на модерации видна всем: %d (%s)", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("правка темы на модерации = %d, ожидалось 409", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/submit", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("повторная отправка = %d, ожидалось 409", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID), Cookies: otherCookies,
		Body: map[string]string{"status": "approved"},
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("модерация без прав админа = %d, ожидалось 404", resp.StatusCode)
	}

	setUserRole(t, cfg.DBUrl, authorLogin, "admin")

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID), Cookies: cookies,
		Body: map[string]string{"status": "rejected"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("отказ без причины = %d (%s), ожидалось 400", resp.StatusCode, raw)
	}

	const note = "Слишком тёмный фон для светлой темы"
	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID), Cookies: cookies,
		Body: map[string]string{"status": "rejected", "note": note},
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme.Status != "rejected" {
		t.Fatalf("отказ = %d (%s), ожидался статус rejected", resp.StatusCode, raw)
	}
	if body.Theme.Note != note {
		t.Errorf("причина отказа не сохранилась: %q", body.Theme.Note)
	}

	resp, list, raw := call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/theme-packages", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK || len(list.Themes) != 1 {
		t.Fatalf("свои темы после отказа = %d (%s)", resp.StatusCode, raw)
	}
	if list.Themes[0].Note != note {
		t.Errorf("автор не видит причину отказа: %q", list.Themes[0].Note)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme.Status != "draft" {
		t.Fatalf("правка после отказа = %d (%s), ожидался статус draft", resp.StatusCode, raw)
	}
	if body.Theme.Note != "" {
		t.Errorf("причина отказа не сброшена: %q", body.Theme.Note)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/submit", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("повторная отправка после отказа = %d (%s)", resp.StatusCode, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID), Cookies: cookies,
		Body: map[string]string{"status": "approved"},
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme.Status != "approved" {
		t.Fatalf("одобрение = %d (%s), ожидался статус approved", resp.StatusCode, raw)
	}
	if body.Theme.PublishedAt == "" {
		t.Error("у опубликованной темы нет published_at")
	}

	resp, published, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes"})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("каталог тем = %d (%s)", resp.StatusCode, raw)
	}

	visible := false
	for _, item := range published.Themes {
		if item.Key != themeKey {
			continue
		}
		visible = true
		if item.Variables["--bg-canvas"] != "#141018" {
			t.Errorf("в каталоге другие переменные: %+v", item.Variables)
		}
	}
	if !visible {
		t.Errorf("опубликованная тема не видна в каталоге: %s", raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: cookies, Body: themeDraft(key),
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("правка опубликованной темы = %d, ожидалось 409", resp.StatusCode)
	}

	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/admin/actions", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK || !strings.Contains(raw, "theme_approved") {
		t.Errorf("модерация не попала в журнал: %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodDelete, Path: fmt.Sprintf("/theme-packages/%d", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление темы = %d (%s)", resp.StatusCode, raw)
	}

	resp, published, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes"})
	for _, item := range published.Themes {
		if item.Key == themeKey {
			t.Errorf("удалённая тема осталась в каталоге: %s", item.Key)
		}
	}
}

func TestThemePackageLimit(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("thl_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	userID := userIDByLogin(t, cfg.DBUrl, login)
	seedThemePackages(t, cfg.DBUrl, userID, models.ThemeMaxPackagesPerUser)

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies,
		Body: themeDraft(fmt.Sprintf("limit-%d", suffix)),
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("тема сверх лимита = %d (%s), ожидалось 409", resp.StatusCode, raw)
	}
}

func setUserRole(t *testing.T, url, login, role string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение к БД: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `UPDATE users SET role = $1 WHERE login = $2`, role, login); err != nil {
		t.Fatalf("смена роли %s: %v", login, err)
	}
}

func seedThemePackages(t *testing.T, url string, authorID, count int) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение к БД: %v", err)
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, `INSERT INTO theme_packages (author_id, theme_key, title, variables)
		SELECT $1::int, 'seed-' || $1 || '-' || value, 'Заготовка ' || value, '{"--accent": "#ffffff"}'::jsonb
		FROM generate_series(1, $2::int) AS value`, authorID, count)
	if err != nil {
		t.Fatalf("подготовка тем: %v", err)
	}
}
