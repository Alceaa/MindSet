package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestPrivateSourceHidesSnapshot(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("pn_%d", suffix)
	saverLogin := fmt.Sprintf("ps_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	source := createPublicSet(t, app, authorCookies, "Секрет", "тайна", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение снимка = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut,
		Path:   fmt.Sprintf("/sets/%d", source.ID),
		Body: map[string]any{
			"title":      "Секрет",
			"visibility": "private",
			"content":    "тайна",
		},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("смена видимости = %d: %s", resp.StatusCode, raw)
	}

	_, listBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: saverCookies,
	})
	if len(listBody.Saved) != 1 {
		t.Fatalf("ожидалась одна запись библиотеки: %s", raw)
	}
	if listBody.Saved[0].State != "hidden" {
		t.Errorf("приватный источник должен давать hidden, получено %q", listBody.Saved[0].State)
	}
	if listBody.Saved[0].Content != "" {
		t.Errorf("приватный источник обязан скрывать тело снимка, получено %q", listBody.Saved[0].Content)
	}
}

func TestPrivateThenDeleteGivesSuppressed(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("pn_%d", suffix)
	saverLogin := fmt.Sprintf("ps_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	source := createPublicSet(t, app, authorCookies, "Отзыв", "текст", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение снимка = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut,
		Path:   fmt.Sprintf("/sets/%d", source.ID),
		Body: map[string]any{
			"title":      "Отзыв",
			"visibility": "private",
			"content":    "текст",
		},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("смена видимости = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", source.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление источника = %d: %s", resp.StatusCode, raw)
	}

	_, listBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: saverCookies,
	})
	if len(listBody.Saved) != 1 {
		t.Fatalf("ожидалась одна запись библиотеки: %s", raw)
	}
	if listBody.Saved[0].State != "suppressed" {
		t.Errorf("после private->delete ожидалось suppressed, получено %q", listBody.Saved[0].State)
	}
	if listBody.Saved[0].Content != "" {
		t.Errorf("suppressed обязан скрывать тело, получено %q", listBody.Saved[0].Content)
	}
}

func TestForbidCopiesBlocksSaving(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("fn_%d", suffix)
	saverLogin := fmt.Sprintf("fs_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	source := createPublicSet(t, app, authorCookies, "Нельзя копировать", "закрыто", true)
	if !source.ForbidCopies {
		t.Fatalf("forbid_copies не сохранился при создании")
	}

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("сохранение запрещённого сета = %d (%s), ожидалось 403", resp.StatusCode, raw)
	}
}
