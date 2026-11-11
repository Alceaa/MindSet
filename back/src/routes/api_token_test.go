package routes

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func TestAPITokenLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("tk_%d", suffix)
	otherLogin := fmt.Sprintf("tk_other_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login, otherLogin}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	set := createSetForPrivacy(t, app, cookies, "Сет для интеграции", "private")

	resp, _, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api-tokens"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("список токенов без сессии = %d, ожидалось 401", resp.StatusCode)
	}

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/api-tokens",
		Cookies: cookies,
		Body:    map[string]any{"title": "Мой скрипт", "expires_in_days": 30},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание токена = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}
	if body.Token == nil || body.Token.ID == 0 {
		t.Fatalf("ответ создания без токена: %s", raw)
	}
	if !strings.HasPrefix(body.Value, utils.APITokenPrefix) {
		t.Fatalf("значение токена %q без префикса %q", body.Value, utils.APITokenPrefix)
	}
	if body.Token.Prefix != utils.APITokenLabel(body.Value) {
		t.Errorf("подпись %q не совпадает со значением %q", body.Token.Prefix, utils.APITokenLabel(body.Value))
	}
	if body.Token.ExpiresAt == "" {
		t.Error("у токена со сроком не заполнен expires_at")
	}

	tokenID := body.Token.ID
	secret := body.Value

	resp, list, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api-tokens", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("список токенов = %d: %s", resp.StatusCode, raw)
	}
	if len(list.Tokens) != 1 {
		t.Fatalf("в списке %d токенов, ожидался 1: %s", len(list.Tokens), raw)
	}
	if strings.Contains(raw, secret) {
		t.Fatalf("значение токена попало в список: %s", raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/api-tokens/%d", tokenID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("чужой отзыв токена = %d, ожидалось 404", resp.StatusCode)
	}

	resp, me, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me", Bearer: secret})
	if resp.StatusCode != fiber.StatusOK || me.User == nil || me.User.Login != login {
		t.Fatalf("GET /api/v1/me по токену = %d (%s), ожидался профиль %s", resp.StatusCode, raw, login)
	}

	resp, sets, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/sets", Bearer: secret})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("GET /api/v1/sets = %d: %s", resp.StatusCode, raw)
	}

	visible := false
	for _, item := range sets.Sets {
		if item.ID == set.ID {
			visible = true
		}
	}
	if !visible {
		t.Errorf("свой сет %d не виден по токену: %s", set.ID, raw)
	}

	resp, one, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   fmt.Sprintf("/api/v1/sets/%d", set.ID),
		Bearer: secret,
	})
	if resp.StatusCode != fiber.StatusOK || one.Set == nil || one.Set.Content == "" {
		t.Fatalf("GET /api/v1/sets/%d = %d (%s), ожидался сет с содержимым", set.ID, resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/collections", Bearer: secret})
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("GET /api/v1/collections = %d: %s", resp.StatusCode, raw)
	}

	resp, graph, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/graph", Bearer: secret})
	if resp.StatusCode != fiber.StatusOK || len(graph.Nodes) == 0 {
		t.Errorf("GET /api/v1/graph = %d (%s), ожидался непустой граф", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("GET /api/v1/me без токена = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me", Bearer: "msk_битый-токен"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("GET /api/v1/me с мусором = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me", Cookies: cookies})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("cookie-сессия на /api/v1 = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets", Bearer: secret})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("токен интеграции на обычном API = %d, ожидалось 401", resp.StatusCode)
	}

	resp, list, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api-tokens", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK || len(list.Tokens) != 1 {
		t.Fatalf("список токенов после использования = %d: %s", resp.StatusCode, raw)
	}
	if list.Tokens[0].LastUsedAt == "" {
		t.Error("last_used_at не заполнился после запроса по токену")
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/api-tokens/%d", tokenID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отзыв токена = %d: %s", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me", Bearer: secret})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("отозванный токен = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/api-tokens/%d", tokenID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("повторный отзыв = %d, ожидалось 404", resp.StatusCode)
	}
}

func TestAPITokenValidationAndLimit(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("tl_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/api-tokens",
		Cookies: cookies,
		Body:    map[string]any{"title": "   ", "expires_in_days": 30},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("пустое название токена = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/api-tokens",
		Cookies: cookies,
		Body:    map[string]any{"title": "Слишком долго", "expires_in_days": 5000},
	})
	if resp.StatusCode != fiber.StatusBadRequest || !containsField(body.Errors, "expires_in_days") {
		t.Errorf("срок 5000 дней = %d (%s), ожидалась ошибка поля expires_in_days", resp.StatusCode, raw)
	}

	userID := userIDByLogin(t, cfg.DBUrl, login)
	seedAPITokens(t, cfg.DBUrl, userID, 20)

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/api-tokens",
		Cookies: cookies,
		Body:    map[string]any{"title": "Двадцать первый", "expires_in_days": 0},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("токен сверх лимита = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}
}

func TestAPITokenExpiry(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("te_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/api-tokens",
		Cookies: cookies,
		Body:    map[string]any{"title": "Истекающий", "expires_in_days": 0},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание токена без срока = %d: %s", resp.StatusCode, raw)
	}
	if body.Token.ExpiresAt != "" {
		t.Errorf("у токена без срока появился expires_at %q", body.Token.ExpiresAt)
	}

	expireAPIToken(t, cfg.DBUrl, body.Token.ID)

	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api/v1/me", Bearer: body.Value})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Errorf("истёкший токен = %d, ожидалось 401: %s", resp.StatusCode, raw)
	}

	resp, list, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/api-tokens", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK || len(list.Tokens) != 1 {
		t.Fatalf("список с истёкшим токеном = %d: %s", resp.StatusCode, raw)
	}
	if !list.Tokens[0].Expired {
		t.Error("истёкший токен не помечен как expired")
	}
}

func userIDByLogin(t *testing.T, url, login string) int {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение к БД: %v", err)
	}
	defer conn.Close(ctx)

	var id int
	if err := conn.QueryRow(ctx, `SELECT id FROM users WHERE login = $1`, login).Scan(&id); err != nil {
		t.Fatalf("пользователь %q не найден: %v", login, err)
	}

	return id
}

func seedAPITokens(t *testing.T, url string, userID, count int) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение к БД: %v", err)
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, `INSERT INTO api_tokens (user_id, title, prefix, token_hash)
		SELECT $1::int, 'Заполнение ' || value, 'msk_seed', 'seed-' || $1::text || '-' || value
		FROM generate_series(1, $2::int) AS value`, userID, count)
	if err != nil {
		t.Fatalf("подготовка токенов: %v", err)
	}
}

func expireAPIToken(t *testing.T, url string, id int) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("подключение к БД: %v", err)
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, `UPDATE api_tokens SET expires_at = now() - interval '1 minute' WHERE id = $1`, id)
	if err != nil {
		t.Fatalf("сдвиг срока токена: %v", err)
	}
}
