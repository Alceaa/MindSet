package routes

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func createPublicSet(t *testing.T, app *fiber.App, cookies []*http.Cookie, title, content string, forbid bool) *apiSet {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/sets",
		Body: map[string]any{
			"title":         title,
			"visibility":    "public",
			"content":       content,
			"forbid_copies": forbid,
		},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusCreated || body.Set == nil {
		t.Fatalf("создание сета %q = %d: %s", title, resp.StatusCode, raw)
	}
	return body.Set
}

func TestSnapshotSurvivesSourceDeletion(t *testing.T) {
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

	source := createPublicSet(t, app, authorCookies, "Бессрочный", "текст", false)

	resp, saveBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated || len(saveBody.Saved) != 1 {
		t.Fatalf("сохранение снимка = %d: %s", resp.StatusCode, raw)
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
		t.Fatalf("снимок исчез вместе с источником (%s)", raw)
	}

	saved := listBody.Saved[0]
	if saved.State != "source_gone" {
		t.Errorf("состояние после удаления источника = %q, ожидалось source_gone", saved.State)
	}
	if saved.Content != "текст" {
		t.Errorf("тело снимка должно сохраняться бессрочно, получено %q", saved.Content)
	}
}
