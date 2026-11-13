package routes

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

type boardResponse struct {
	Board *struct {
		ID         int             `json:"id"`
		Title      string          `json:"title"`
		Visibility string          `json:"visibility"`
		Doc        json.RawMessage `json:"doc"`
	} `json:"board"`
	Boards []struct {
		ID         int    `json:"id"`
		Title      string `json:"title"`
		Visibility string `json:"visibility"`
	} `json:"boards"`
	Saved bool `json:"saved"`
}

func parseBoardResponse(t *testing.T, raw string) boardResponse {
	t.Helper()

	var parsed boardResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("разбор ответа доски: %v (%s)", err, raw)
	}

	return parsed
}

func boardDocIDs(t *testing.T, doc json.RawMessage) []string {
	t.Helper()

	var scene struct {
		Elements []struct {
			ID string `json:"id"`
		} `json:"elements"`
	}
	if err := json.Unmarshal(doc, &scene); err != nil {
		t.Fatalf("разбор сцены доски: %v (%s)", err, string(doc))
	}

	ids := make([]string, 0, len(scene.Elements))
	for _, element := range scene.Elements {
		ids = append(ids, element.ID)
	}

	return ids
}

// Доска живёт как сет: создать, открыть, переименовать, сохранить сцену, удалить.
func TestBoardLifecycle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("bd_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{login})
	})

	cookies := registerVerified(t, app, login, login+"@example.com", password)

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/boards",
		Body: map[string]any{
			"title": "Схема деплоя",
			"doc": map[string]any{
				"elements": []map[string]any{{"id": "rect-1", "type": "rectangle"}},
				"appState": map[string]any{"viewBackgroundColor": "#ffffff"},
			},
		},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание доски = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}

	created := parseBoardResponse(t, raw)
	if created.Board == nil || created.Board.ID == 0 {
		t.Fatalf("в ответе нет доски: %s", raw)
	}
	boardID := created.Board.ID

	if ids := boardDocIDs(t, created.Board.Doc); len(ids) != 1 || ids[0] != "rect-1" {
		t.Fatalf("сцена созданной доски = %v, ожидался один элемент rect-1", ids)
	}

	// Список отдаёт доски без сцены.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/boards",
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("список досок = %d: %s", resp.StatusCode, raw)
	}

	listed := parseBoardResponse(t, raw)
	if len(listed.Boards) != 1 || listed.Boards[0].ID != boardID {
		t.Fatalf("в списке досок %d записей: %s", len(listed.Boards), raw)
	}

	// Автосохранение сцены: приходит часто и меняет только сцену.
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPut,
		Path:   fmt.Sprintf("/boards/%d/doc", boardID),
		Body: map[string]any{
			"doc": map[string]any{
				"elements": []map[string]any{{"id": "rect-2", "type": "rectangle"}},
				"appState": map[string]any{},
			},
		},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сохранение сцены = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("открытие доски = %d: %s", resp.StatusCode, raw)
	}

	opened := parseBoardResponse(t, raw)
	if opened.Board == nil {
		t.Fatalf("в ответе нет доски: %s", raw)
	}
	if ids := boardDocIDs(t, opened.Board.Doc); len(ids) != 1 || ids[0] != "rect-2" {
		t.Fatalf("сцена после автосохранения = %v, ожидался rect-2", ids)
	}
	if opened.Board.Title != "Схема деплоя" {
		t.Fatalf("название доски изменилось: %q", opened.Board.Title)
	}

	// Переименование и видимость.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Body:    map[string]string{"title": "Схема деплоя 2", "visibility": "unlisted"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("правка доски = %d: %s", resp.StatusCode, raw)
	}

	updated := parseBoardResponse(t, raw)
	if updated.Board == nil || updated.Board.Title != "Схема деплоя 2" || updated.Board.Visibility != "unlisted" {
		t.Fatalf("доска после правки: %s", raw)
	}

	// Удаление.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление доски = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("открытие удалённой доски = %d, ожидалось 404: %s", resp.StatusCode, raw)
	}
}

// Чужую доску не отдаём и не правим: она для нас не существует.
func TestBoardPrivacy(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("bda_%d", suffix)
	otherLogin := fmt.Sprintf("bdo_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, otherLogin})
	})

	authorCookies := registerVerified(t, app, authorLogin, authorLogin+"@example.com", password)
	otherCookies := registerVerified(t, app, otherLogin, otherLogin+"@example.com", password)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]string{"title": "Личная схема"},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание доски автора = %d: %s", resp.StatusCode, raw)
	}

	boardID := parseBoardResponse(t, raw).Board.ID

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужая доска отдана: %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/boards/%d/doc", boardID),
		Body:    map[string]any{"doc": map[string]any{"elements": []any{}}},
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужую доску удалось сохранить: %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/boards/%d", boardID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужую доску удалось удалить: %d: %s", resp.StatusCode, raw)
	}

	// Список у второго пользователя пустой: чужие доски в него не попадают.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/boards",
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("список досок второго пользователя = %d: %s", resp.StatusCode, raw)
	}
	if listed := parseBoardResponse(t, raw); len(listed.Boards) != 0 {
		t.Fatalf("в чужом списке %d досок: %s", len(listed.Boards), raw)
	}
}

// Названия досок уникальны у одного пользователя: по названию доска подставляется в текст сета.
func TestBoardTitleConflictAndValidation(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("bdc_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{login})
	})

	cookies := registerVerified(t, app, login, login+"@example.com", password)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]string{"title": "Одна доска"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание доски = %d: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]string{"title": "одна доска"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("дубликат названия = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]string{"title": "   "},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("пустое название = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]string{"title": "Секретная", "visibility": "секретно"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("неизвестная видимость = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/boards",
		Body:    map[string]any{"title": "Со строкой вместо сцены", "doc": "просто текст"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("сцена не объектом = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}

	// Без авторизации доски недоступны.
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/boards",
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("список досок без входа = %d, ожидалось 401: %s", resp.StatusCode, raw)
	}
}
