package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestDelayedDeleteKeepsCopyTitle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("tda_%d", suffix)
	saverLogin := fmt.Sprintf("tds_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	source := createPublicSet(t, app, authorCookies, "Имя удалённого сета", "тело для копии", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("сохранение копии = %d: %s", resp.StatusCode, raw)
	}

	resp, statsBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d/copy-stats", source.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK || statsBody.CopyCount != 1 || statsBody.AccountCount != 1 {
		t.Fatalf("статистика копий владельцу = %d (%s): %+v", resp.StatusCode, raw, statsBody)
	}
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d/copy-stats", source.ID),
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужой доступ к статистике копий = %d (%s), ожидалось 404", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", source.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление источника = %d: %s", resp.StatusCode, raw)
	}

	_, listBody, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/saved-sets", Cookies: saverCookies})
	if len(listBody.Saved) != 1 {
		t.Fatalf("ожидалась одна копия: %s", raw)
	}
	kept := listBody.Saved[0]
	if kept.Title != "Имя удалённого сета" {
		t.Errorf("имя удалённого сета должно сохраняться, получено %q", kept.Title)
	}
	if kept.State != "source_gone" || kept.Content != "тело для копии" {
		t.Errorf("до deadline копия читается: state=%q content=%q", kept.State, kept.Content)
	}
	if !kept.Frozen || !kept.FrozenAuto {
		t.Errorf("копия должна быть заморожена автоматически: %+v", kept)
	}

	_, tombstoneBody, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/set-tombstones", Cookies: authorCookies})
	if len(tombstoneBody.Tombstones) != 1 {
		t.Fatalf("ожидался один ярлык удаления, получено %d: %s", len(tombstoneBody.Tombstones), raw)
	}
	tombstone := tombstoneBody.Tombstones[0]
	if tombstone.SetID != source.ID || tombstone.ForbidApplied || tombstone.Deadline == "" {
		t.Fatalf("ярлык размечен неверно: %+v", tombstone)
	}
	if tombstone.Title != "Имя удалённого сета" {
		t.Errorf("ярлык удаления должен помнить имя сета, получено %q", tombstone.Title)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/set-tombstones/%d/forbid-copies", tombstone.ID),
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужой запрет копий = %d (%s), ожидалось 404", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/set-tombstones/%d/forbid-copies", tombstone.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("досрочный запрет копий = %d: %s", resp.StatusCode, raw)
	}

	_, forbadeBody, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/saved-sets", Cookies: saverCookies})
	if len(forbadeBody.Saved) != 1 {
		t.Fatalf("копия пропала после запрета: %s", raw)
	}
	forbade := forbadeBody.Saved[0]
	if forbade.Title != "Имя удалённого сета" {
		t.Errorf("имя сета должно пережить запрет копий, получено %q", forbade.Title)
	}
	if forbade.State != "suppressed" || forbade.Content != "" {
		t.Errorf("после запрета копия отзывается без тела: state=%q content=%q", forbade.State, forbade.Content)
	}
}
