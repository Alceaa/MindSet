package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

// Правка опубликованной темы: автор меняет её сам, правка ждёт модерации, а в каталоге
// продолжает работать прежняя версия. Отклонение правки тему с публикации не снимает.
func TestPublishedThemeUpdateLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("tu_%d", suffix)
	otherLogin := fmt.Sprintf("tu_other_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{authorLogin, otherLogin}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, authorLogin, authorLogin+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	payload := themeDraft("")
	payload["title"] = fmt.Sprintf("Обновляемая тема %d", suffix)
	payload["variables"] = map[string]string{"--bg-canvas": "#101010", "--accent": "#ffcc00"}

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost, Path: "/theme-packages", Cookies: cookies, Body: payload,
	})
	if resp.StatusCode != fiber.StatusCreated || body.Theme == nil {
		t.Fatalf("создание темы = %d (%s)", resp.StatusCode, raw)
	}
	themeID := body.Theme.ID
	themeKey := body.Theme.Key

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/submit", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отправка на модерацию = %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID),
		Cookies: cookies, Body: map[string]string{"status": "approved"},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("одобрение темы = %d (%s)", resp.StatusCode, raw)
	}

	publishedCanvas := func() string {
		t.Helper()

		resp, published, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/themes"})
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("каталог тем = %d (%s)", resp.StatusCode, raw)
		}
		for _, item := range published.Themes {
			if item.Key == themeKey {
				return item.Variables["--bg-canvas"]
			}
		}

		return ""
	}

	if got := publishedCanvas(); got != "#101010" {
		t.Fatalf("в каталоге %q, ожидался исходный цвет", got)
	}

	// Автор правит опубликованную тему: правка уходит на модерацию, каталог не меняется.
	update := themeDraft("")
	update["title"] = payload["title"]
	update["variables"] = map[string]string{"--bg-canvas": "#202020", "--accent": "#ffcc00"}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID),
		Cookies: cookies, Body: update,
	})
	if resp.StatusCode != fiber.StatusOK || body.Theme == nil || body.Theme.Pending == nil {
		t.Fatalf("правка опубликованной темы = %d (%s)", resp.StatusCode, raw)
	}
	if got := publishedCanvas(); got != "#101010" {
		t.Errorf("каталог показал неодобренную правку: %q", got)
	}

	resp, queue, raw := call(t, app, callOptions{
		Method: fiber.MethodGet, Path: "/admin/themes?status=pending", Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("очередь модерации = %d (%s)", resp.StatusCode, raw)
	}
	inQueue := false
	for _, item := range queue.Themes {
		if item.ID == themeID && item.Pending != nil {
			inQueue = true
		}
	}
	if !inQueue {
		t.Errorf("правка не попала в очередь модерации: %s", raw)
	}

	// Отклонение правки тему с публикации не снимает: в каталоге остаётся прежняя версия.
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID),
		Cookies: cookies, Body: map[string]string{"status": "rejected", "note": "Слишком контрастно"},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отклонение правки = %d (%s)", resp.StatusCode, raw)
	}
	if got := publishedCanvas(); got != "#101010" {
		t.Errorf("после отклонения правки каталог = %q", got)
	}

	// Вторая правка и одобрение: новая версия заменяет прежнюю.
	update["variables"] = map[string]string{"--bg-canvas": "#303030", "--accent": "#ffcc00"}
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/theme-packages/%d", themeID),
		Cookies: cookies, Body: update,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вторая правка = %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: fmt.Sprintf("/admin/themes/%d/status", themeID),
		Cookies: cookies, Body: map[string]string{"status": "approved"},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("одобрение правки = %d (%s)", resp.StatusCode, raw)
	}
	if got := publishedCanvas(); got != "#303030" {
		t.Errorf("после одобрения правки каталог = %q, ожидался новый цвет", got)
	}

	// Автор сам снимает тему с публикации — без админа.
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/withdraw", themeID), Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("снятие с публикации = %d (%s)", resp.StatusCode, raw)
	}
	if got := publishedCanvas(); got != "" {
		t.Errorf("снятая с публикации тема осталась в каталоге: %q", got)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost, Path: fmt.Sprintf("/theme-packages/%d/withdraw", themeID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("чужое снятие с публикации = %d, ожидалось 404", resp.StatusCode)
	}
}
