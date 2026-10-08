package routes

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func registerSnapshotUser(t *testing.T, app *fiber.App, login, password string) []*http.Cookie {
	t.Helper()

	return registerVerified(t, app, login, login+"@example.com", password)
}

func TestSavedSetLibraryLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("sn_%d", suffix)
	saverLogin := fmt.Sprintf("sv_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	resp, authorBody, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/sets",
		Body: map[string]any{
			"title":       "Заметки автора",
			"visibility":  "public",
			"description": "источник для снимка",
			"content":     "первая редакция",
		},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusCreated || authorBody.Set == nil {
		t.Fatalf("создание публичного сета = %d: %s", resp.StatusCode, raw)
	}
	sourceSlug := authorBody.Set.Slug
	sourceID := authorBody.Set.ID

	resp, saverBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": sourceSlug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение внешнего сета = %d: %s", resp.StatusCode, raw)
	}
	if len(saverBody.Saved) != 1 {
		t.Fatalf("ожидался один снимок, получено %d", len(saverBody.Saved))
	}

	saved := saverBody.Saved[0]
	if saved.SourceLogin != authorLogin {
		t.Errorf("автор снимка = %q, ожидался %q", saved.SourceLogin, authorLogin)
	}
	if saved.State != "live" {
		t.Errorf("состояние снимка = %q, ожидалось live", saved.State)
	}
	if saved.Content != "первая редакция" {
		t.Errorf("снимок не сохранил тело источника: %q", saved.Content)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": sourceSlug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("повторное сохранение = %d: %s", resp.StatusCode, raw)
	}

	_, listBody, _ := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: saverCookies,
	})
	if len(listBody.Saved) != 1 {
		t.Fatalf("повторное сохранение создало дубликат: %d записей", len(listBody.Saved))
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/saved-sets/%d/freeze", listBody.Saved[0].ID),
		Body:    map[string]bool{"frozen": true},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("заморозка = %d: %s", resp.StatusCode, raw)
	}

	_, freezeBody, _ := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/saved-sets/%d", listBody.Saved[0].ID),
		Cookies: saverCookies,
	})
	if len(freezeBody.Saved) != 1 || freezeBody.Saved[0].State != "frozen" {
		t.Fatalf("после заморозки ожидалось состояние frozen, получено %+v", freezeBody.Saved)
	}
	if !freezeBody.Saved[0].Frozen {
		t.Errorf("флаг frozen не сохранился: %+v", freezeBody.Saved[0])
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/saved-sets/%d", listBody.Saved[0].ID),
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление из библиотеки = %d: %s", resp.StatusCode, raw)
	}

	_, emptyBody, _ := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: saverCookies,
	})
	if len(emptyBody.Saved) != 0 {
		t.Fatalf("после удаления остались записи: %d", len(emptyBody.Saved))
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", sourceID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("источник должен остаться у автора после удаления из библиотеки = %d: %s", resp.StatusCode, raw)
	}
}
