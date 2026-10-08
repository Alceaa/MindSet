package handlers

import (
	"context"
	"fmt"
	"testing"
	"time"

	"mindset/db"
	"mindset/models"

	"github.com/gofiber/fiber/v2"
)

func TestAdminEndpointsRequireAdminRole(t *testing.T) {
	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("admin_plain_%d", suffix)

	user := createTestUser(t, login, models.RoleUser, false)
	t.Cleanup(func() { cleanupAdminUsers(t, []string{login}) })

	app := adminPanelApp(user)

	response, _, _ := callAdminAPI(t, app, fiber.MethodGet, "/admin/users", nil)
	if response.StatusCode != fiber.StatusNotFound {
		t.Fatalf("обычный пользователь = %d, ожидалось 404 (маршрут скрыт)", response.StatusCode)
	}

	response, _, _ = callAdminAPI(t, app, fiber.MethodPost, "/admin/news", map[string]any{
		"title": "тест-нельзя", "body": "текст", "is_published": true,
	})
	if response.StatusCode != fiber.StatusNotFound {
		t.Fatalf("новость от обычного пользователя = %d, ожидалось 404", response.StatusCode)
	}
}

func TestAdminBlockUserKillsSessions(t *testing.T) {
	suffix := time.Now().UnixNano()
	adminLogin := fmt.Sprintf("admin_boss_%d", suffix)
	targetLogin := fmt.Sprintf("admin_target_%d", suffix)

	admin := createTestUser(t, adminLogin, models.RoleAdmin, false)
	target := createTestUser(t, targetLogin, models.RoleUser, false)
	t.Cleanup(func() { cleanupAdminUsers(t, []string{adminLogin, targetLogin}) })

	app := adminPanelApp(admin)

	response, _, raw := callAdminAPI(t, app, fiber.MethodPost,
		fmt.Sprintf("/admin/users/%d/block", target.ID), map[string]string{"reason": "спам"})
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("блокировка = %d: %s", response.StatusCode, raw)
	}

	blocked, err := db.GetUserById(context.Background(), target.ID)
	if err != nil {
		t.Fatalf("перечитать: %v", err)
	}
	if !blocked.IsBlocked() || blocked.BlockedReason != "спам" {
		t.Fatalf("пользователь не заблокирован: %+v", blocked)
	}
	if blocked.TokenEpoch <= target.TokenEpoch {
		t.Fatalf("эпоха токенов не изменилась: было %d, стало %d", target.TokenEpoch, blocked.TokenEpoch)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodPost,
		fmt.Sprintf("/admin/users/%d/block", admin.ID), map[string]string{"reason": "сам себя"})
	if response.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("самоблокировка = %d, ожидалось 400: %s", response.StatusCode, raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodPut,
		fmt.Sprintf("/admin/users/%d/role", admin.ID), map[string]string{"role": "user"})
	if response.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("снятие роли с себя = %d, ожидалось 400: %s", response.StatusCode, raw)
	}

	response, _, raw = callAdminAPI(t, app, fiber.MethodPost,
		fmt.Sprintf("/admin/users/%d/unblock", target.ID), nil)
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("разблокировка = %d: %s", response.StatusCode, raw)
	}

	unblocked, err := db.GetUserById(context.Background(), target.ID)
	if err != nil {
		t.Fatalf("перечитать: %v", err)
	}
	if unblocked.IsBlocked() {
		t.Fatalf("пользователь всё ещё заблокирован: %+v", unblocked)
	}
}
