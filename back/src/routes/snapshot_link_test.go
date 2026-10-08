package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestOwnerWikilinkFallsBackToSnapshot(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("ska_%d", suffix)
	saverLogin := fmt.Sprintf("skb_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, saverLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	saverCookies := registerSnapshotUser(t, app, saverLogin, password)

	source := createPublicSet(t, app, authorCookies, fmt.Sprintf("Конспект %d", suffix), "текст", false)

	resp, saveBody, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/saved-sets",
		Body:    map[string]string{"slug": source.Slug},
		Cookies: saverCookies,
	})
	if resp.StatusCode != fiber.StatusCreated || len(saveBody.Saved) != 1 {
		t.Fatalf("сохранение снимка = %d: %s", resp.StatusCode, raw)
	}
	snapshotID := saveBody.Saved[0].ID

	content := fmt.Sprintf("см. [[@%s/%s|конспект]]", authorLogin, source.Slug)
	note := createSetWithContent(t, app, saverCookies, fmt.Sprintf("Заметка %d", suffix), content, "private")

	link := requireSingleLink(t, loadLinks(t, app, saverCookies, note.ID))
	if link.TargetID != source.ID || !link.LiveAvailable {
		t.Fatalf("ссылка на живой источник = %+v, ожидалась разрешённая цель", link)
	}
	if link.Label != fmt.Sprintf("@%s/%s", authorLogin, source.Slug) || link.Alias != "конспект" {
		t.Errorf("разметка ссылки = %+v, ожидалась кросс-ссылка с подписью", link)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", source.ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление источника = %d: %s", resp.StatusCode, raw)
	}

	link = requireSingleLink(t, loadLinks(t, app, saverCookies, note.ID))
	if link.TargetID != 0 || link.LiveAvailable || !link.Broken {
		t.Errorf("после удаления источника ссылка = %+v, ожидалась недоступная живая цель", link)
	}
	if link.SnapshotID != snapshotID {
		t.Errorf("снимок = %d, ожидался %d (%+v)", link.SnapshotID, snapshotID, link)
	}
	if link.SnapshotState != "source_gone" {
		t.Errorf("состояние ссылки = %q, ожидалось source_gone", link.SnapshotState)
	}
}
