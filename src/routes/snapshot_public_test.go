package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestPublicParentResolvesSnapshot(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("pa_%d", suffix)
	ownerLogin := fmt.Sprintf("po_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, ownerLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	ownerCookies := registerSnapshotUser(t, app, ownerLogin, password)

	target := createPublicSet(t, app, authorCookies, fmt.Sprintf("Цель %d", suffix), "тело цели", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": target.Slug},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение цели = %d: %s", resp.StatusCode, raw)
	}

	_, libraryBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: ownerCookies,
	})
	if len(libraryBody.Saved) != 1 {
		t.Fatalf("библиотека владельца пуста: %s", raw)
	}
	snapshotID := libraryBody.Saved[0].ID

	resp, parentBody, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/sets",
		Body: map[string]any{
			"title":      fmt.Sprintf("Родитель %d", suffix),
			"visibility": "public",
			"content":    fmt.Sprintf("см. [[@%s/%s]]", authorLogin, target.Slug),
		},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated || parentBody.Set == nil {
		t.Fatalf("создание родителя = %d: %s", resp.StatusCode, raw)
	}
	parent := parentBody.Set

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", target.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление цели = %d: %s", resp.StatusCode, raw)
	}

	_, publicParent, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/sets/" + parent.Slug,
	})
	if publicParent.Set == nil || len(publicParent.Links) != 1 {
		t.Fatalf("публичный родитель без связи (%s)", raw)
	}
	link := publicParent.Links[0]
	if link.TargetID != 0 {
		t.Errorf("цель удалена, target_id = %d", link.TargetID)
	}
	if link.SnapshotID != snapshotID {
		t.Errorf("snapshot_id = %d, ожидался %d", link.SnapshotID, snapshotID)
	}
	if link.SnapshotState != "source_gone" {
		t.Errorf("snapshot_state = %q, ожидался source_gone", link.SnapshotState)
	}

	_, snapshotBody, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   fmt.Sprintf("/public/snapshots/%d", snapshotID),
	})
	if snapshotBody.Snapshot == nil {
		t.Fatalf("публичный снимок недоступен через родителя: %s", raw)
	}
	if snapshotBody.Snapshot.State != "source_gone" {
		t.Errorf("состояние публичного снимка = %q, ожидалось source_gone", snapshotBody.Snapshot.State)
	}
	if snapshotBody.Snapshot.Content != "тело цели" {
		t.Errorf("тело снимка утеряно: %q", snapshotBody.Snapshot.Content)
	}

	_, ownerParent, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", parent.ID),
		Cookies: ownerCookies,
	})
	if len(ownerParent.Links) != 1 || ownerParent.Links[0].SnapshotState != "source_gone" {
		t.Fatalf("связь у владельца не резолвит снимок: %+v (%s)", ownerParent.Links, raw)
	}
}

func TestHiddenSnapshotIsNotPublic(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("ha_%d", suffix)
	ownerLogin := fmt.Sprintf("ho_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, ownerLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	ownerCookies := registerSnapshotUser(t, app, ownerLogin, password)

	target := createPublicSet(t, app, authorCookies, fmt.Sprintf("Скрытое %d", suffix), "закрыто", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": target.Slug},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение цели = %d: %s", resp.StatusCode, raw)
	}
	_, libraryBody, _ := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: ownerCookies,
	})
	if len(libraryBody.Saved) != 1 {
		t.Fatalf("библиотека владельца пуста")
	}
	snapshotID := libraryBody.Saved[0].ID

	resp, parentBody, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/sets",
		Body: map[string]any{
			"title":      fmt.Sprintf("Публичный родитель %d", suffix),
			"visibility": "public",
			"content":    fmt.Sprintf("см. [[@%s/%s]]", authorLogin, target.Slug),
		},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated || parentBody.Set == nil {
		t.Fatalf("создание родителя = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut,
		Path:   fmt.Sprintf("/sets/%d", target.ID),
		Body: map[string]any{
			"title":      target.Title,
			"visibility": "private",
			"content":    "закрыто",
		},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("смена видимости = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   fmt.Sprintf("/public/snapshots/%d", snapshotID),
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("приватный снимок доступен анонимно = %d, ожидалось 404: %s", resp.StatusCode, raw)
	}
}
