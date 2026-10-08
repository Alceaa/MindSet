package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"mindset/models"

	"github.com/gofiber/fiber/v2"
)

func parseNewsItemID(t *testing.T, raw string) int {
	t.Helper()

	var payload struct {
		News struct {
			ID int `json:"id"`
		} `json:"news"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("разбор ответа: %v (%s)", err, raw)
	}
	return payload.News.ID
}

func parseNewsIDs(t *testing.T, raw string) []int {
	t.Helper()

	var payload struct {
		News []struct {
			ID int `json:"id"`
		} `json:"news"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("разбор списка: %v (%s)", err, raw)
	}

	ids := make([]int, 0, len(payload.News))
	for _, item := range payload.News {
		ids = append(ids, item.ID)
	}
	return ids
}

func parseActionNames(t *testing.T, raw string) []string {
	t.Helper()

	var payload struct {
		Actions []struct {
			Action string `json:"action"`
		} `json:"actions"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("разбор журнала: %v (%s)", err, raw)
	}

	names := make([]string, 0, len(payload.Actions))
	for _, item := range payload.Actions {
		names = append(names, item.Action)
	}
	return names
}

func TestAdminNewsAndJournal(t *testing.T) {
	suffix := time.Now().UnixNano()
	adminLogin := fmt.Sprintf("admin_news_%d", suffix)

	admin := createTestUser(t, adminLogin, models.RoleAdmin, false)
	t.Cleanup(func() { cleanupAdminUsers(t, []string{adminLogin}) })

	app := adminPanelApp(admin)
	title := fmt.Sprintf("тест-новость-%d", suffix)
	ordinaryTitle := fmt.Sprintf("тест-обычная-%d", suffix)

	response, _, raw := callAdminAPI(t, app, fiber.MethodPost, "/admin/news", map[string]any{
		"title": ordinaryTitle, "body": "обычная новость", "is_published": true,
	})
	if response.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание новости = %d: %s", response.StatusCode, raw)
	}
	ordinaryID := parseNewsItemID(t, raw)

	response, _, raw = callAdminAPI(t, app, fiber.MethodPost, "/admin/news", map[string]any{
		"title": title, "body": "текст новости", "is_published": true, "is_pinned": true,
	})
	if response.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание закреплённой новости = %d: %s", response.StatusCode, raw)
	}

	newsID := parseNewsItemID(t, raw)
	if newsID == 0 {
		t.Fatalf("в ответе нет идентификатора новости: %s", raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodGet, "/admin/news", nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("список новостей = %d: %s", response.StatusCode, raw)
	}

	found := false
	for _, id := range parseNewsIDs(t, raw) {
		if id == newsID {
			found = true
		}
	}
	if !found {
		t.Fatalf("новость не найдена в списке: %s", raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodGet, "/news", nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("публичный список = %d: %s", response.StatusCode, raw)
	}

	publicIDs := parseNewsIDs(t, raw)
	if len(publicIDs) < 2 || publicIDs[0] != newsID {
		t.Fatalf("закреплённая новость должна быть первой: %v (закреплённая %d, обычная %d)",
			publicIDs, newsID, ordinaryID)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodGet, "/admin/actions", nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("журнал = %d: %s", response.StatusCode, raw)
	}

	logged := false
	for _, name := range parseActionNames(t, raw) {
		if name == "create_news" {
			logged = true
		}
	}
	if !logged {
		t.Fatalf("в журнале нет записи о создании новости: %s", raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodDelete, fmt.Sprintf("/admin/news/%d", newsID), nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление новости = %d: %s", response.StatusCode, raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodDelete, fmt.Sprintf("/admin/news/%d", newsID), nil)
	if response.StatusCode != fiber.StatusNotFound {
		t.Fatalf("повторное удаление = %d, ожидалось 404: %s", response.StatusCode, raw)
	}
}

func TestAdminSearchUsersAndSets(t *testing.T) {
	suffix := time.Now().UnixNano()
	adminLogin := fmt.Sprintf("admin_search_%d", suffix)
	userLogin := fmt.Sprintf("admin_found_%d", suffix)

	admin := createTestUser(t, adminLogin, models.RoleAdmin, false)
	createTestUser(t, userLogin, models.RoleUser, false)
	t.Cleanup(func() { cleanupAdminUsers(t, []string{adminLogin, userLogin}) })

	app := adminPanelApp(admin)

	response, _, raw := callAdminAPI(t, app, fiber.MethodGet, "/admin/users?q="+userLogin, nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("поиск пользователей = %d: %s", response.StatusCode, raw)
	}
	if !strings.Contains(raw, userLogin) {
		t.Fatalf("поиск не нашёл созданного пользователя: %s", raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodGet, "/admin/users?blocked=true", nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("фильтр заблокированных = %d: %s", response.StatusCode, raw)
	}
}
