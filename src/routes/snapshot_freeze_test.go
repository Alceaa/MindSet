package routes

import (
	"context"
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func backdateSnapshot(t *testing.T, url string, id int) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение для backdate: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(
		ctx,
		`UPDATE saved_sets SET last_update = CURRENT_DATE - 1 WHERE id = $1`,
		id,
	); err != nil {
		t.Fatalf("backdate снимка: %v", err)
	}
}

func TestFrozenSnapshotSemantics(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("fa_%d", suffix)
	ownerLogin := fmt.Sprintf("fo_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, ownerLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	ownerCookies := registerSnapshotUser(t, app, ownerLogin, password)

	target := createPublicSet(t, app, authorCookies, fmt.Sprintf("Заморозка %d", suffix), "v1", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": target.Slug},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение = %d: %s", resp.StatusCode, raw)
	}

	_, libraryBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: ownerCookies,
	})
	if len(libraryBody.Saved) != 1 {
		t.Fatalf("библиотека пуста: %s", raw)
	}
	snapshotID := libraryBody.Saved[0].ID

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/saved-sets/%d/freeze", snapshotID),
		Body:    map[string]bool{"frozen": true},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("заморозка = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut,
		Path:   fmt.Sprintf("/sets/%d", target.ID),
		Body: map[string]any{
			"title":      target.Title,
			"visibility": "public",
			"content":    "v2",
		},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("автор изменил источник = %d: %s", resp.StatusCode, raw)
	}

	resp, repeatBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": target.Slug},
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("повторное сохранение = %d: %s", resp.StatusCode, raw)
	}
	repeat := repeatBody.Saved[0]
	if repeat.Content != "v1" {
		t.Errorf("замороженное тело затёрлось повторным сохранением: %q", repeat.Content)
	}
	if !repeat.Frozen || repeat.FrozenAuto {
		t.Errorf("ручная заморозка: frozen=%v frozen_auto=%v, ожидалось true/false", repeat.Frozen, repeat.FrozenAuto)
	}

	backdateSnapshot(t, cfg.DBUrl, snapshotID)

	_, libraryBody, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/saved-sets",
		Cookies: ownerCookies,
	})
	if len(libraryBody.Saved) != 1 {
		t.Fatalf("библиотека пуста после backdate: %s", raw)
	}
	if libraryBody.Saved[0].State != "attention" {
		t.Errorf("заморозка + изменения автора = %q, ожидалось attention", libraryBody.Saved[0].State)
	}
	if libraryBody.AttentionCount != 1 {
		t.Errorf("attention_count = %d, ожидался 1", libraryBody.AttentionCount)
	}

	resp, refreshBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/saved-sets/%d/refresh", snapshotID),
		Cookies: ownerCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("обновление снимка = %d: %s", resp.StatusCode, raw)
	}
	refreshed := refreshBody.Saved[0]
	if refreshed.Content != "v2" {
		t.Errorf("после refresh тело = %q, ожидалось v2", refreshed.Content)
	}
	if !refreshed.Frozen {
		t.Errorf("refresh не должен снимать заморозку: %+v", refreshed)
	}
	if refreshed.State != "frozen" {
		t.Errorf("после refresh состояние = %q, ожидалось frozen", refreshed.State)
	}
}
