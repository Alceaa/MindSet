package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func themeRoles(accent string) map[string]string {
	return map[string]string{
		"canvas":  "#101010",
		"surface": "#181c22",
		"text":    "#e8eaee",
		"border":  "#2a2f38",
		"accent":  accent,
		"danger":  "#e07a7a",
		"warning": "#d8b06a",
		"success": "#86c9a2",
	}
}

func themeBody(title string, roles map[string]string) map[string]any {
	return map[string]any{
		"title":       title,
		"description": "Своя тема",
		"mode":        "dark",
		"base":        "dark",
		"roles":       roles,
	}
}

// Библиотека тем: пользователь сохраняет несколько оформлений и правит их сам.
// Каталога и модерации нет, поэтому проверяем CRUD, ключи, лимит и права доступа.
func TestThemeLibraryLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("thl_%d", suffix)
	otherLogin := fmt.Sprintf("thl_other_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login, otherLogin}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	// Библиотека нового пользователя пуста.
	resp, body, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK || len(body.Themes) != 0 {
		t.Fatalf("пустая библиотека = %d (%s)", resp.StatusCode, raw)
	}

	// Ключ собирается из названия — придумывать его не нужно.
	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Морская ночь", themeRoles("#5fc4d8")),
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil {
		t.Fatalf("сохранение темы = %d (%s)", resp.StatusCode, raw)
	}
	themeID := body.Theme.ID
	if body.Theme.Key != "morskaya-noch" {
		t.Errorf("ключ темы = %q, ожидался morskaya-noch", body.Theme.Key)
	}
	if body.Theme.Roles["accent"] != "#5fc4d8" {
		t.Errorf("роли темы = %v", body.Theme.Roles)
	}

	// Роли проверяем строго: неизвестная роль и цвет не в виде #rrggbb не проходят.
	if resp, _, _ := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Лишняя роль", map[string]string{"shadow": "#ffffff"}),
	}); resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("неизвестная роль = %d, ожидалось 400", resp.StatusCode)
	}
	if resp, _, _ := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Короткий цвет", map[string]string{"accent": "#fff"}),
	}); resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("цвет #fff = %d, ожидалось 400", resp.StatusCode)
	}

	// Другой автор сохраняет тему с тем же названием: ключи больше не глобальные,
	// поэтому конфликта между пользователями нет — это и была «каша» прежнего каталога.
	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: otherCookies,
		Body: themeBody("Морская ночь", themeRoles("#a3be8c")),
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil || body.Theme.Key != "morskaya-noch" {
		t.Fatalf("тема другого автора с тем же названием = %d (%s)", resp.StatusCode, raw)
	}

	// Чужая тема недоступна: ни правка, ни удаление.
	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/themes/%d", themeID), Cookies: otherCookies,
		Body: themeBody("Морская ночь", themeRoles("#5fc4d8")),
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("правка чужой темы = %d, ожидалось 404", resp.StatusCode)
	}
	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodDelete, Path: fmt.Sprintf("/themes/%d", themeID), Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("удаление чужой темы = %d, ожидалось 404", resp.StatusCode)
	}

	// Своя тема правится на месте: ключ остаётся прежним, чтобы не слетело применённое оформление.
	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/themes/%d", themeID), Cookies: cookies,
		Body: themeBody("Морская ночь вечер", themeRoles("#b18cff")),
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme == nil {
		t.Fatalf("правка своей темы = %d (%s)", resp.StatusCode, raw)
	}
	if body.Theme.Key != "morskaya-noch" || body.Theme.Roles["accent"] != "#b18cff" {
		t.Errorf("после правки: ключ %q, роли %v", body.Theme.Key, body.Theme.Roles)
	}

	// Повтор названия у автора: свободный ключ достаётся без приставки, а занятый — с приставкой.
	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Морская ночь вечер", themeRoles("#e2b053")),
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil {
		t.Fatalf("повтор названия = %d (%s)", resp.StatusCode, raw)
	}
	if body.Theme.Key != "morskaya-noch-vecher" {
		t.Errorf("ключ повтора = %q", body.Theme.Key)
	}
	duplicateID := body.Theme.ID

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Морская ночь вечер", themeRoles("#7ecb9d")),
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil {
		t.Fatalf("второй повтор названия = %d (%s)", resp.StatusCode, raw)
	}
	if body.Theme.Key != "morskaya-noch-vecher-2" {
		t.Errorf("ключ второго повтора = %q", body.Theme.Key)
	}
	secondDuplicateID := body.Theme.ID

	// Удаление: свои темы исчезают, соседняя остаётся.
	for _, id := range []int{duplicateID, secondDuplicateID} {
		resp, _, raw = call(t, app, callOptions{
			Method: fiber.MethodDelete, Path: fmt.Sprintf("/themes/%d", id), Cookies: cookies,
		})
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("удаление темы %d = %d (%s)", id, resp.StatusCode, raw)
		}
	}

	resp, body, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK || len(body.Themes) != 1 || body.Themes[0].ID != themeID {
		t.Errorf("после удаления библиотека = %d (%s)", resp.StatusCode, raw)
	}
	if body.Limit != 10 {
		t.Errorf("лимит библиотеки = %d, ожидалось 10", body.Limit)
	}
}

// В библиотеке помещается десять тем: одиннадцатая не сохраняется с понятной ошибкой.
func TestThemeLibraryLimit(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("thl_limit_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	cookies := registerForPrivacy(t, app, login, login+"@example.com", "sup3r-secret-password")

	for index := 0; index < 10; index++ {
		resp, _, raw := call(t, app, callOptions{
			Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
			Body: themeBody(fmt.Sprintf("Тема номер %d", index), themeRoles("#5fc4d8")),
		})
		if resp.StatusCode != fiber.StatusCreated {
			t.Fatalf("сохранение темы %d = %d (%s)", index, resp.StatusCode, raw)
		}
	}

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Cookies: cookies,
		Body: themeBody("Лишняя тема", themeRoles("#5fc4d8")),
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("одиннадцатая тема = %d (%s), ожидалось 409", resp.StatusCode, raw)
	}
}

func TestThemeLibraryRequiresAuth(t *testing.T) {
	app := setupApp(t)

	resp, _, _ := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("библиотека без авторизации = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/themes", Body: themeBody("Гостевая тема", themeRoles("#5fc4d8")),
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("сохранение без авторизации = %d, ожидалось 401", resp.StatusCode)
	}
}