package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mindset/db"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("ENV_FILE", filepath.Join("..", ".env"))
	os.Exit(m.Run())
}

type validationError struct {
	Field   string `json:"field"`
	Tag     string `json:"tag"`
	Message string `json:"message"`
}

type apiUser struct {
	ID       int    `json:"id"`
	Login    string `json:"login"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type apiSet struct {
	ID           int    `json:"id"`
	UserID       int    `json:"user_id"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	Visibility   string `json:"visibility"`
	ForbidCopies bool   `json:"forbid_copies"`
	Description  string `json:"description"`
	Content      string `json:"content"`
	DateCreated  string `json:"date_created"`
	LastActivity string `json:"last_activity"`
	Author       *struct {
		Login string `json:"login"`
	} `json:"author"`
}

type apiLink struct {
	Label         string `json:"label"`
	Alias         string `json:"alias"`
	TargetID      int    `json:"target_id"`
	TargetTitle   string `json:"target_title"`
	TargetSlug    string `json:"target_slug"`
	TargetUserID  int    `json:"target_user_id"`
	Own           bool   `json:"own"`
	OneSided      bool   `json:"one_sided"`
	Broken        bool   `json:"broken"`
	ResolvedOnce  bool   `json:"resolved_once"`
	SnapshotID    int    `json:"snapshot_id"`
	SnapshotState string `json:"snapshot_state"`
	LiveAvailable bool   `json:"live_available"`
}

type apiBacklink struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	OneSided bool   `json:"one_sided"`
}

type apiGraphNode struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	Links      int    `json:"links"`
	Backlinks  int    `json:"backlinks"`
	Updated    string `json:"updated"`
	Own        bool   `json:"own"`
	Slug       string `json:"slug"`
	Login      string `json:"login"`
	SnapshotID int    `json:"snapshot_id"`
}

type apiGraphEdge struct {
	From     int  `json:"from"`
	To       int  `json:"to"`
	OneSided bool `json:"one_sided"`
}

type apiTombstone struct {
	ID            int    `json:"id"`
	SetID         int    `json:"set_id"`
	Title         string `json:"title"`
	Deadline      string `json:"deadline"`
	ForbidApplied bool   `json:"forbid_applied"`
	OwnerID       int    `json:"owner_id"`
}

type apiSavedSet struct {
	ID           int    `json:"id"`
	SetID        int    `json:"set_id"`
	SourceLogin  string `json:"source_login"`
	SourceSlug   string `json:"source_slug"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	Frozen       bool   `json:"frozen"`
	FrozenAuto   bool   `json:"frozen_auto"`
	RevokedAt    string `json:"revoked_at"`
	State        string `json:"state"`
	DateSaved    string `json:"date_saved"`
	SnapshotID   int    `json:"snapshot_id"`
	LiveTitle    string `json:"live_title"`
	LiveActivity string `json:"live_last_activity"`
	LastUpdate   string `json:"last_update"`
}

type apiResponse struct {
	Status         string            `json:"status"`
	Message        string            `json:"message"`
	Errors         []validationError `json:"errors"`
	User           *apiUser          `json:"user"`
	Sets           []apiSet          `json:"sets"`
	Set            *apiSet           `json:"set"`
	Links          []apiLink         `json:"links"`
	Backlinks      []apiBacklink     `json:"backlinks"`
	Nodes          []apiGraphNode    `json:"nodes"`
	Edges          []apiGraphEdge    `json:"edges"`
	Saved          []apiSavedSet     `json:"saved"`
	Attention      []apiSavedSet     `json:"attention"`
	AttentionCount int               `json:"attention_count"`
	Snapshot       *apiSavedSet      `json:"snapshot"`
	Tombstones     []apiTombstone    `json:"tombstones"`
	CopyCount      int               `json:"copy_count"`
	AccountCount   int               `json:"account_count"`
}

type callOptions struct {
	Method      string
	Path        string
	Body        any
	Cookies     []*http.Cookie
	Bearer      string
	ContentType string
}

func setupApp(t *testing.T) *fiber.App {
	t.Helper()

	cfg := utils.Config()
	if err := utils.ConfigErr(); err != nil {
		t.Skipf("конфигурация недоступна (%v), интеграционные тесты пропущены", err)
	}
	if err := db.Open(cfg.DBUrl); err != nil {
		t.Skipf("БД недоступна (%v), интеграционные тесты пропущены", err)
	}

	app := fiber.New()
	app.Use(middlewares.RequireJSONBody)
	SetupRoutes(app)
	return app
}

func call(t *testing.T, app *fiber.App, opts callOptions) (*http.Response, apiResponse, string) {
	t.Helper()

	var body io.Reader
	if opts.Body != nil {
		payload, err := json.Marshal(opts.Body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		body = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(opts.Method, opts.Path, body)
	if opts.Body != nil {
		contentType := opts.ContentType
		if contentType == "" {
			contentType = fiber.MIMEApplicationJSON
		}
		req.Header.Set(fiber.HeaderContentType, contentType)
	}
	for _, cookie := range opts.Cookies {
		req.AddCookie(cookie)
	}
	if opts.Bearer != "" {
		req.Header.Set(fiber.HeaderAuthorization, "Bearer "+opts.Bearer)
	}

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", opts.Method, opts.Path, err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	_ = resp.Body.Close()

	var parsed apiResponse
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &parsed)
	}
	return resp, parsed, string(raw)
}

func cookieByName(t *testing.T, cookies []*http.Cookie, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("cookie %q не найдена", name)
	return nil
}

func deleteUsers(t *testing.T, url string, logins []string) {
	t.Helper()
	if len(logins) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Logf("cleanup: не удалось подключиться: %v", err)
		return
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `DELETE FROM users WHERE login = ANY($1)`, logins); err != nil {
		t.Logf("cleanup: %v", err)
	}
}

func containsField(errors []validationError, field string) bool {
	for _, item := range errors {
		if item.Field == field {
			return true
		}
	}
	return false
}

func findLink(links []apiLink, label string) *apiLink {
	for index := range links {
		if links[index].Label == label {
			return &links[index]
		}
	}
	return nil
}

func findNode(nodes []apiGraphNode, id int) *apiGraphNode {
	for index := range nodes {
		if nodes[index].ID == id {
			return &nodes[index]
		}
	}
	return nil
}

func findEdge(edges []apiGraphEdge, from, to int) *apiGraphEdge {
	for index := range edges {
		if edges[index].From == from && edges[index].To == to {
			return &edges[index]
		}
	}
	return nil
}

func findEdgeAny(edges []apiGraphEdge, a, b int) *apiGraphEdge {
	for index := range edges {
		if (edges[index].From == a && edges[index].To == b) ||
			(edges[index].From == b && edges[index].To == a) {
			return &edges[index]
		}
	}
	return nil
}

func TestAuthAndSetsFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("it_%d", suffix)
	email := login + "@example.com"
	const password = "sup3r-secret-password"

	logins := []string{login, login + "_alt"}
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, logins) })

	resp, _, _ := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/auth/me"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("/auth/me без cookie = %d, ожидалось 401", resp.StatusCode)
	}
	if resp.StatusCode == fiber.StatusUnsupportedMediaType {
		t.Fatal("GET-запрос заблокирован фильтром Content-Type")
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets"})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("GET /sets без cookie = %d, ожидалось 401", resp.StatusCode)
	}

	resp, body, _ := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            "ab",
			"email":            "not-an-email",
			"password":         "123",
			"password_confirm": "456",
		},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("невалидная регистрация = %d, ожидалось 400", resp.StatusCode)
	}
	for _, field := range []string{"login", "email", "password", "password_confirm"} {
		if !containsField(body.Errors, field) {
			t.Errorf("нет ошибки валидации для поля %s: %+v", field, body.Errors)
		}
	}

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            login,
			"email":            email,
			"password":         password,
			"password_confirm": password,
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("регистрация = %d (%s), ожидалось 201", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.ID == 0 {
		t.Fatalf("в ответе нет пользователя: %s", raw)
	}
	if strings.Contains(raw, `"password"`) || strings.Contains(raw, "$2a$") {
		t.Fatalf("ответ регистрации содержит данные пароля: %s", raw)
	}
	userID := body.User.ID

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            login,
			"email":            email,
			"password":         password,
			"password_confirm": password,
		},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("повторная регистрация = %d, ожидалось 409", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": "wrong-password"},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("неверный пароль = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": "no_such_user_here", "password": password},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("несуществующий пользователь = %d, ожидалось 401", resp.StatusCode)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход = %d (%s), ожидалось 200", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.ID != userID {
		t.Fatalf("вход вернул другого пользователя: %s", raw)
	}

	accessCookie := cookieByName(t, resp.Cookies(), utils.AccessTokenCookie)
	refreshCookie := cookieByName(t, resp.Cookies(), utils.RefreshTokenCookie)
	if !accessCookie.HttpOnly || !refreshCookie.HttpOnly {
		t.Fatal("cookie с токенами должны быть HttpOnly")
	}
	if accessCookie.Path != "/" {
		t.Errorf("Path cookie = %q, ожидалось \"/\"", accessCookie.Path)
	}
	if accessCookie.Domain != "" {
		t.Errorf("Domain cookie = %q, ожидалось пустое значение", accessCookie.Domain)
	}
	if accessCookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("SameSite = %v, ожидалось Lax", accessCookie.SameSite)
	}
	if accessCookie.MaxAge <= 0 {
		t.Errorf("MaxAge access-cookie = %d, ожидалось положительное значение", accessCookie.MaxAge)
	}
	if refreshCookie.MaxAge <= accessCookie.MaxAge {
		t.Error("срок жизни refresh-cookie должен быть больше, чем у access-cookie")
	}

	authCookies := []*http.Cookie{accessCookie, refreshCookie}

	resp, body, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/auth/me", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("/auth/me = %d (%s), ожидалось 200", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.Login != login {
		t.Fatalf("/auth/me вернул не того пользователя: %s", raw)
	}
	if strings.Contains(raw, `"password"`) {
		t.Fatalf("/auth/me отдал данные пароля: %s", raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/auth/me",
		Bearer: accessCookie.Value,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("/auth/me по Bearer = %d, ожидалось 200", resp.StatusCode)
	}

	resp, body, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK || len(body.Sets) != 0 {
		t.Fatalf("новый пользователь должен иметь 0 сетов, получено %d (%d)", len(body.Sets), resp.StatusCode)
	}

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body:    map[string]string{"title": "Первый сет", "description": "Описание"},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание сета = %d (%s), ожидалось 201", resp.StatusCode, raw)
	}
	if body.Set == nil || body.Set.ID == 0 {
		t.Fatalf("в ответе нет сета: %s", raw)
	}
	if body.Set.UserID != userID {
		t.Errorf("user_id сета = %d, ожидалось %d (владелец проставляется сервером)", body.Set.UserID, userID)
	}
	if body.Set.DateCreated == "" || body.Set.LastActivity == "" {
		t.Error("даты сета не заполнены базой")
	}
	setID := body.Set.ID

	resp, body, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK || len(body.Sets) != 1 || body.Sets[0].ID != setID {
		t.Fatalf("список сетов вернул не то: %d, %+v", resp.StatusCode, body.Sets)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: fmt.Sprintf("/sets/%d", setID), Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("получение сета = %d, ожидалось 200", resp.StatusCode)
	}
	resp, body, _ = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body:    map[string]string{"title": "", "description": "без названия"},
	})
	if resp.StatusCode != fiber.StatusBadRequest || !containsField(body.Errors, "title") {
		t.Fatalf("сет без названия: статус %d, ошибки %+v", resp.StatusCode, body.Errors)
	}

	otherLogin := login + "_alt"
	otherEmail := otherLogin + "@example.com"
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            otherLogin,
			"email":            otherEmail,
			"password":         password,
			"password_confirm": password,
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("регистрация второго пользователя = %d (%s)", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": otherEmail, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход по email = %d (%s), ожидалось 200", resp.StatusCode, raw)
	}
	otherCookies := resp.Cookies()

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", setID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("чужой сет = %d, ожидалось 404", resp.StatusCode)
	}

	resp, body, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets", Cookies: otherCookies})
	if resp.StatusCode != fiber.StatusOK || len(body.Sets) != 0 {
		t.Fatalf("второй пользователь видит чужие сеты: %+v", body.Sets)
	}

	markdown := "# Заголовок\n\nТекст с **разметкой** и [ссылкой](https://go.dev).\n\n- пункт\n- пункт\n"

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body: map[string]string{
			"title":       "Сет с содержимым",
			"description": "проверка markdown",
			"content":     markdown,
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание сета с содержимым = %d (%s)", resp.StatusCode, raw)
	}
	if body.Set.Content != markdown {
		t.Fatalf("содержимое не сохранилось при создании: %q", body.Set.Content)
	}
	contentSetID := body.Set.ID

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("чтение сета = %d (%s)", resp.StatusCode, raw)
	}
	if body.Set.Content != markdown {
		t.Fatalf("содержимое не вернулось при чтении: %q", body.Set.Content)
	}

	updatedMarkdown := markdown + "\nДобавленный абзац с `кодом`.\n"
	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
		Body: map[string]string{
			"title":       "Обновлённый заголовок",
			"description": "обновлено",
			"content":     updatedMarkdown,
		},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("обновление сета = %d (%s)", resp.StatusCode, raw)
	}
	if body.Set.Title != "Обновлённый заголовок" || body.Set.Content != updatedMarkdown {
		t.Fatalf("обновление не применилось: %s", raw)
	}

	resp, body, _ = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
		Body:    map[string]string{"title": "", "content": "текст"},
	})
	if resp.StatusCode != fiber.StatusBadRequest || !containsField(body.Errors, "title") {
		t.Fatalf("обновление без названия: статус %d, ошибки %+v", resp.StatusCode, body.Errors)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: otherCookies,
		Body:    map[string]string{"title": "Захват", "content": "чужое"},
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("изменение чужого сета = %d, ожидалось 404", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("удаление чужого сета = %d, ожидалось 404", resp.StatusCode)
	}

	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/sets", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("список сетов = %d (%s)", resp.StatusCode, raw)
	}
	if strings.Contains(raw, `"content"`) {
		t.Errorf("список сетов отдаёт содержимое, ожидалась только сводка: %s", raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление сета = %d (%s)", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("удалённый сет всё ещё доступен: %d", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", contentSetID),
		Cookies: authCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("повторное удаление = %d, ожидалось 404", resp.StatusCode)
	}

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body:    map[string]string{"title": "Целевой сет", "content": "# Цель\n"},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание целевого сета = %d (%s)", resp.StatusCode, raw)
	}
	targetID := body.Set.ID

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body: map[string]string{
			"title":   "Сет со ссылками",
			"content": "Смотри [[Целевой сет]] и [[Несуществующий сет|алиас]].\n\n```\n[[Внутри кода]]\n```\n",
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание сета со ссылками = %d (%s)", resp.StatusCode, raw)
	}
	sourceID := body.Set.ID

	if len(body.Links) != 2 {
		t.Fatalf("ожидались 2 связи: ссылка внутри кода не считается, а ссылка на несуществующий сет остаётся видимой как битая: %+v", body.Links)
	}

	link := findLink(body.Links, "Целевой сет")
	if link == nil || link.TargetID != targetID || link.TargetTitle != "Целевой сет" {
		t.Fatalf("связь с существующим сетом разобрана неверно: %+v", body.Links)
	}
	if !link.OneSided {
		t.Fatalf("связь должна быть односторонней, пока целевой сет не ссылается обратно: %+v", link)
	}
	if link.Broken || !link.ResolvedOnce || !link.Own || link.TargetSlug == "" {
		t.Errorf("разрешённая связь размечена неверно: %+v", link)
	}

	other := findLink(body.Links, "Несуществующий сет")
	if other == nil {
		t.Fatalf("ссылка на несуществующий сет потерялась: %+v", body.Links)
	}
	if !other.Broken || other.TargetID != 0 || other.ResolvedOnce {
		t.Errorf("битая связь размечена неверно: %+v", other)
	}
	if findLink(body.Links, "Внутри кода") != nil {
		t.Errorf("ссылка внутри блока кода попала в связи: %+v", body.Links)
	}

	resp, body, raw = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", targetID),
		Cookies: authCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("чтение целевого сета = %d (%s)", resp.StatusCode, raw)
	}
	if len(body.Backlinks) != 1 || body.Backlinks[0].ID != sourceID {
		t.Fatalf("обратные ссылки неверны: %+v", body.Backlinks)
	}
	if !body.Backlinks[0].OneSided {
		t.Fatalf("обратная ссылка должна быть односторонней: %+v", body.Backlinks[0])
	}

	resp, body, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("граф = %d (%s)", resp.StatusCode, raw)
	}
	edge := findEdge(body.Edges, sourceID, targetID)
	if edge == nil {
		t.Fatalf("в графе нет ребра %d -> %d: %+v", sourceID, targetID, body.Edges)
	}
	if !edge.OneSided {
		t.Fatalf("ребро должно быть односторонним: %+v", edge)
	}
	if reverse := findEdge(body.Edges, targetID, sourceID); reverse != nil {
		t.Fatalf("обратного ребра быть не должно, пока нет взаимной ссылки: %+v", reverse)
	}
	if node := findNode(body.Nodes, sourceID); node == nil || node.Links != 1 {
		t.Fatalf("у узла-источника должна быть 1 исходящая связь: %+v", node)
	}
	if node := findNode(body.Nodes, targetID); node == nil || node.Backlinks != 1 {
		t.Fatalf("у целевого узла должна быть 1 обратная ссылка: %+v", node)
	}
	for _, node := range body.Nodes {
		if node.Title == "Несуществующий сет" {
			t.Fatalf("в графе появился узел для несуществующего сета: %+v", node)
		}
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", targetID),
		Cookies: authCookies,
		Body:    map[string]string{"title": "Целевой сет", "content": "Обратная ссылка: [[Сет со ссылками]]\n"},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("создание обратной ссылки = %d (%s)", resp.StatusCode, raw)
	}

	resp, body, _ = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", sourceID),
		Cookies: authCookies,
	})
	mutualLink := findLink(body.Links, "Целевой сет")
	if mutualLink == nil || mutualLink.OneSided {
		t.Fatalf("после появления обратной ссылки связь должна стать двусторонней: %+v", body.Links)
	}

	resp, body, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: authCookies})
	if edge := findEdgeAny(body.Edges, sourceID, targetID); edge == nil || edge.OneSided {
		t.Fatalf("ребро должно стать двусторонним: %+v", edge)
	}
	mutual := 0
	for _, candidate := range body.Edges {
		if findEdgeAny([]apiGraphEdge{candidate}, sourceID, targetID) != nil {
			mutual++
		}
	}
	if mutual != 1 {
		t.Fatalf("взаимная связь должна быть ровно одним ребром, получено %d: %+v", mutual, body.Edges)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", targetID),
		Cookies: authCookies,
		Body:    map[string]string{"title": "Целевой сет v2", "content": "Обратная ссылка: [[Сет со ссылками]]\n"},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("переименование сета = %d (%s)", resp.StatusCode, raw)
	}

	resp, body, _ = call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", sourceID),
		Cookies: authCookies,
	})
	renamedLink := findLink(body.Links, "Целевой сет")
	if renamedLink == nil || renamedLink.Broken || renamedLink.TargetID != targetID {
		t.Fatalf("ссылка должна выжить после переименования цели: %+v", body.Links)
	}
	if renamedLink.TargetTitle != "Целевой сет v2" {
		t.Fatalf("заголовок цели не обновился после переименования: %+v", renamedLink)
	}
	if len(body.Backlinks) != 1 || body.Backlinks[0].ID != targetID {
		t.Fatalf("обратная ссылка от переименованного сета должна остаться: %+v", body.Backlinks)
	}

	resp, body, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: authCookies})
	if edge := findEdgeAny(body.Edges, sourceID, targetID); edge == nil || edge.OneSided {
		t.Fatalf("взаимные связи должны остаться в графе после переименования: %+v", body.Edges)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: authCookies,
		Body:    map[string]string{"title": "целевой сет v2", "content": ""},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("дубликат названия = %d, ожидалось 409", resp.StatusCode)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/auth/refresh",
		Cookies: []*http.Cookie{refreshCookie},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("refresh = %d (%s), ожидалось 200", resp.StatusCode, raw)
	}
	newAccess := cookieByName(t, resp.Cookies(), utils.AccessTokenCookie)
	newRefresh := cookieByName(t, resp.Cookies(), utils.RefreshTokenCookie)
	if newAccess.Value == "" || newRefresh.Value == "" {
		t.Error("refresh не вернул новые токены")
	}
	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/auth/me", Bearer: newAccess.Value})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("новый access-токен не работает: %d", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/auth/refresh",
		Cookies: []*http.Cookie{accessCookie},
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("access-токен принят как refresh = %d, ожидалось 401", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{
		Method:      fiber.MethodPost,
		Path:        "/auth/login",
		Body:        map[string]string{"login": login, "password": password},
		ContentType: fiber.MIMETextPlain,
	})
	if resp.StatusCode != fiber.StatusUnsupportedMediaType {
		t.Fatalf("не-JSON тело = %d, ожидалось 415", resp.StatusCode)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodPost, Path: "/auth/logout", Cookies: authCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("logout = %d, ожидалось 200", resp.StatusCode)
	}
	cleared := cookieByName(t, resp.Cookies(), utils.AccessTokenCookie)
	if cleared.Value != "" {
		t.Errorf("cookie не очищена: value=%q", cleared.Value)
	}
	setCookieHeaders := strings.Join(resp.Header.Values(fiber.HeaderSetCookie), "\n")
	if !strings.Contains(setCookieHeaders, utils.AccessTokenCookie+"=;") {
		t.Errorf("access-cookie не очищена: %s", setCookieHeaders)
	}
	if !strings.Contains(strings.ToLower(setCookieHeaders), "expires=") {
		t.Errorf("в Set-Cookie нет expires: %s", setCookieHeaders)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/auth/me",
		Bearer: accessCookie.Value + "broken",
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("поддельный токен = %d, ожидалось 401", resp.StatusCode)
	}
}

func registerForPrivacy(t *testing.T, app *fiber.App, login, email, password string) []*http.Cookie {
	t.Helper()

	_, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            login,
			"email":            email,
			"password":         password,
			"password_confirm": password,
		},
	})
	if !strings.Contains(raw, `"status":"success"`) {
		t.Fatalf("регистрация %s не удалась: %s", login, raw)
	}

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход %s = %d, ожидалось 200: %s", login, resp.StatusCode, raw)
	}

	return []*http.Cookie{cookieByName(t, resp.Cookies(), "access_token")}
}

func createSetForPrivacy(t *testing.T, app *fiber.App, cookies []*http.Cookie, title, visibility string) *apiSet {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: cookies,
		Body: map[string]string{
			"title":       title,
			"content":     "содержимое",
			"visibility":  visibility,
			"description": "описание",
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание сета = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}
	if body.Set == nil {
		t.Fatalf("ответ создания без сета: %s", raw)
	}
	return body.Set
}

func TestSetVisibilityDefaultAndSlug(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("pv_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: cookies,
		Body:    map[string]string{"title": "Мои заметки", "content": "текст"},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание = %d, ожидалось 201: %s", resp.StatusCode, raw)
	}
	if body.Set.Visibility != "private" {
		t.Errorf("видимость по умолчанию = %q, ожидалось \"private\"", body.Set.Visibility)
	}
	if body.Set.Slug != "мои-заметки" {
		t.Errorf("slug = %q, ожидалось \"мои-заметки\"", body.Set.Slug)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets/мои-заметки"})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("приватный сет по публичному адресу = %d, ожидалось 404", resp.StatusCode)
	}
}

func TestPublicSetVisibleWithoutAuth(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("pu_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	created := createSetForPrivacy(t, app, cookies, "Публичная статья", "public")
	if created.Visibility != "public" {
		t.Fatalf("видимость = %q, ожидалось \"public\"", created.Visibility)
	}

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/sets/" + created.Slug,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("чтение публичного сета = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if body.Set == nil || body.Set.Content != "содержимое" {
		t.Fatalf("публичный сет без содержимого: %s", raw)
	}
	if body.Set.Author == nil || body.Set.Author.Login != login {
		t.Errorf("автор публичного сета = %+v, ожидался %q", body.Set.Author, login)
	}

	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodPut, Path: "/public/sets/" + created.Slug,
		Body: map[string]string{"title": "взлом"},
	})
	if resp.StatusCode != fiber.StatusNotFound && resp.StatusCode != fiber.StatusMethodNotAllowed {
		t.Errorf("PUT на публичный маршрут = %d, ожидалось 404 или 405", resp.StatusCode)
	}
}

func TestUnlistedHiddenFromCatalogue(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("ul_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	unlisted := createSetForPrivacy(t, app, cookies, "Скрытая статья", "unlisted")
	published := createSetForPrivacy(t, app, cookies, "Открытая статья", "public")
	private := createSetForPrivacy(t, app, cookies, "Личная статья", "private")

	resp, _, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets/" + unlisted.Slug})
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("чтение unlisted по ссылке = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets/" + private.Slug})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("чтение приватного = %d, ожидалось 404", resp.StatusCode)
	}

	resp, body, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets"})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("витрина = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	visible := map[string]bool{}
	for _, set := range body.Sets {
		visible[set.Slug] = true
		if set.Visibility != "public" {
			t.Errorf("в витрине сет %q с видимостью %q", set.Slug, set.Visibility)
		}
	}
	if !visible[published.Slug] {
		t.Error("публичный сет не попал в витрину")
	}
	if visible[unlisted.Slug] {
		t.Error("unlisted сет не должен попадать в витрину")
	}
	if visible[private.Slug] {
		t.Error("приватный сет не должен попадать в витрину")
	}
}

func TestVisibilityChangedByUpdate(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("vc_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	created := createSetForPrivacy(t, app, cookies, "Смена видимости", "private")
	if created.Visibility != "private" {
		t.Fatalf("стартовая видимость = %q", created.Visibility)
	}

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", created.ID),
		Cookies: cookies,
		Body: map[string]string{
			"title":      "Смена видимости",
			"content":    "текст",
			"visibility": "public",
		},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("обновление = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if body.Set.Visibility != "public" {
		t.Errorf("видимость после обновления = %q, ожидалось \"public\"", body.Set.Visibility)
	}
	if body.Set.Slug != created.Slug {
		t.Errorf("slug изменился при смене видимости: %q -> %q", created.Slug, body.Set.Slug)
	}

	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets/" + created.Slug})
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("сет после публикации = %d, ожидалось 200", resp.StatusCode)
	}
}

func TestInvalidVisibilityRejected(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("vi_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: cookies,
		Body:    map[string]string{"title": "Секрет", "content": "текст", "visibility": "открытый"},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("неизвестная видимость = %d, ожидалось 400: %s", resp.StatusCode, raw)
	}
	if !containsField(body.Errors, "visibility") {
		t.Errorf("нет ошибки по полю visibility: %+v", body.Errors)
	}
}

func TestSlugUniqueness(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	loginA := fmt.Sprintf("su_a_%d", suffix)
	loginB := fmt.Sprintf("su_b_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{loginA, loginB}) })

	const password = "sup3r-secret-password"
	cookiesA := registerForPrivacy(t, app, loginA, loginA+"@example.com", password)
	cookiesB := registerForPrivacy(t, app, loginB, loginB+"@example.com", password)

	first := createSetForPrivacy(t, app, cookiesA, "Общее название", "public")
	second := createSetForPrivacy(t, app, cookiesB, "Общее название", "public")

	if first.Slug == second.Slug {
		t.Fatalf("у двух пользователей один адрес %q", first.Slug)
	}

	for _, set := range []*apiSet{first, second} {
		resp, body, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/sets/" + set.Slug})
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("адрес %q = %d, ожидалось 200: %s", set.Slug, resp.StatusCode, raw)
		}
		if body.Set.ID != set.ID {
			t.Errorf("адрес %q открыл сет %d вместо %d", set.Slug, body.Set.ID, set.ID)
		}
	}
}

func TestPrivateSetsStayOwnerOnly(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	ownerLogin := fmt.Sprintf("ow_%d", suffix)
	otherLogin := fmt.Sprintf("ot_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{ownerLogin, otherLogin}) })

	const password = "sup3r-secret-password"
	ownerCookies := registerForPrivacy(t, app, ownerLogin, ownerLogin+"@example.com", password)
	otherCookies := registerForPrivacy(t, app, otherLogin, otherLogin+"@example.com", password)

	private := createSetForPrivacy(t, app, ownerCookies, "Чужая тайна", "private")

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", private.ID),
		Cookies: otherCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("чужой приватный сет = %d, ожидалось 404: %s", resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", private.ID),
		Cookies: otherCookies,
		Body:    map[string]string{"title": "Взлом", "content": "x"},
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("изменение чужого сета = %d, ожидалось 404: %s", resp.StatusCode, raw)
	}
}

func TestPublicRoutesRejectInvalidSlug(t *testing.T) {
	app := setupApp(t)

	for _, path := range []string{
		"/public/sets/..%2Fetc",
		"/public/sets/under_score",
		"/public/sets/has%20space",
	} {
		resp, _, _ := call(t, app, callOptions{Method: fiber.MethodGet, Path: path})
		if resp.StatusCode != fiber.StatusNotFound {
			t.Errorf("%s = %d, ожидалось 404", path, resp.StatusCode)
		}
	}
}

func createSetWithContent(t *testing.T, app *fiber.App, cookies []*http.Cookie, title, content, visibility string) *apiSet {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: cookies,
		Body: map[string]string{
			"title":       title,
			"content":     content,
			"visibility":  visibility,
			"description": "описание",
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание сета %q = %d, ожидалось 201: %s", title, resp.StatusCode, raw)
	}
	if body.Set == nil {
		t.Fatalf("ответ создания %q без сета: %s", title, raw)
	}
	return body.Set
}

func renameSet(t *testing.T, app *fiber.App, cookies []*http.Cookie, set *apiSet, title, content, visibility string) *apiSet {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", set.ID),
		Cookies: cookies,
		Body: map[string]string{
			"title":      title,
			"content":    content,
			"visibility": visibility,
		},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("обновление сета %d = %d, ожидалось 200: %s", set.ID, resp.StatusCode, raw)
	}
	if body.Set == nil {
		t.Fatalf("ответ обновления %d без сета: %s", set.ID, raw)
	}
	return body.Set
}

func loadLinks(t *testing.T, app *fiber.App, cookies []*http.Cookie, setID int) []apiLink {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    fmt.Sprintf("/sets/%d", setID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("чтение сета %d = %d, ожидалось 200: %s", setID, resp.StatusCode, raw)
	}
	return body.Links
}

func requireSingleLink(t *testing.T, links []apiLink) apiLink {
	t.Helper()

	if len(links) != 1 {
		t.Fatalf("ссылок = %d (%+v), ожидалась одна", len(links), links)
	}
	return links[0]
}

func TestCatalogueReturnsAuthorAndSupportsSearch(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("ca_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	unique := fmt.Sprintf("Каталог %d", suffix)
	published := createSetForPrivacy(t, app, cookies, unique, "public")
	createSetForPrivacy(t, app, cookies, fmt.Sprintf("Спрятанный %d", suffix), "private")

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/sets?q=" + url.QueryEscape(unique),
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("поиск в каталоге = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	found := false
	for _, set := range body.Sets {
		if set.ID != published.ID {
			continue
		}
		found = true
		if set.Author == nil || set.Author.Login != login {
			t.Errorf("автор в каталоге = %+v, ожидался %q", set.Author, login)
		}
	}
	if !found {
		t.Fatalf("сет %q не найден поиском в каталоге: %s", unique, raw)
	}

	resp, body, raw = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/sets?q=" + url.QueryEscape("заведомо-нет-такого-названия"),
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("пустой поиск в каталоге = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if len(body.Sets) != 0 {
		t.Errorf("по несуществующему запросу вернулось %d сетов", len(body.Sets))
	}
}

func TestLinkSurvivesTargetRename(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("lr_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	targetTitle := fmt.Sprintf("Цель %d", suffix)
	target := createSetWithContent(t, app, cookies, targetTitle, "тело", "public")
	source := createSetWithContent(
		t, app, cookies, fmt.Sprintf("Источник %d", suffix), "[["+targetTitle+"]]", "private",
	)

	link := requireSingleLink(t, loadLinks(t, app, cookies, source.ID))
	if link.Broken || link.TargetID != target.ID {
		t.Fatalf("до переименования ссылка = %+v, ожидалась на сет %d", link, target.ID)
	}

	renamed := renameSet(t, app, cookies, target, fmt.Sprintf("Новое имя %d", suffix), "тело", "public")
	if renamed.Slug != target.Slug {
		t.Errorf("адрес изменился при переименовании: %q -> %q", target.Slug, renamed.Slug)
	}

	link = requireSingleLink(t, loadLinks(t, app, cookies, source.ID))
	if link.Broken || link.TargetID != target.ID {
		t.Errorf("после переименования ссылка = %+v, ожидалась на сет %d", link, target.ID)
	}
	if link.TargetTitle != renamed.Title {
		t.Errorf("заголовок цели = %q, ожидался %q", link.TargetTitle, renamed.Title)
	}
}

func TestLinkMarkedBrokenAfterTargetDeleted(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("lb_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	targetTitle := fmt.Sprintf("Временная цель %d", suffix)
	target := createSetWithContent(t, app, cookies, targetTitle, "тело", "public")
	source := createSetWithContent(
		t, app, cookies, fmt.Sprintf("Зависимый %d", suffix), "[["+targetTitle+"]]", "private",
	)

	requireSingleLink(t, loadLinks(t, app, cookies, source.ID))

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", target.ID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление цели = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	link := requireSingleLink(t, loadLinks(t, app, cookies, source.ID))
	if !link.Broken {
		t.Errorf("ссылка %+v не помечена битой после удаления цели", link)
	}
	if !link.ResolvedOnce {
		t.Errorf("ссылка %+v потеряла признак ранее разрешённой", link)
	}
	if link.TargetID != 0 {
		t.Errorf("target_id = %d, ожидался 0", link.TargetID)
	}
}

func TestBrokenLinkNotRevivedByRecreatedTitle(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("rv_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	targetTitle := fmt.Sprintf("Возрождённая цель %d", suffix)
	target := createSetWithContent(t, app, cookies, targetTitle, "тело", "public")
	source := createSetWithContent(
		t, app, cookies, fmt.Sprintf("Наблюдатель %d", suffix), "[["+targetTitle+"]]", "private",
	)

	call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    fmt.Sprintf("/sets/%d", target.ID),
		Cookies: cookies,
	})

	fresh := createSetWithContent(t, app, cookies, targetTitle, "тело", "public")
	if fresh.ID == target.ID {
		t.Fatalf("пересозданный сет получил тот же id %d", fresh.ID)
	}

	link := requireSingleLink(t, loadLinks(t, app, cookies, source.ID))
	if !link.Broken || link.TargetID != 0 {
		t.Errorf("старая ссылка ожила на новый сет: %+v", link)
	}

	renameSet(t, app, cookies, source, fmt.Sprintf("Наблюдатель %d", suffix),
		"[["+targetTitle+"]]", "private")

	link = requireSingleLink(t, loadLinks(t, app, cookies, source.ID))
	if link.Broken || link.TargetID != fresh.ID {
		t.Errorf("после пересохранения ссылка = %+v, ожидалась на новый сет %d", link, fresh.ID)
	}
}

func TestCrossAuthorLink(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	loginA := fmt.Sprintf("xa_%d", suffix)
	loginB := fmt.Sprintf("xb_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{loginA, loginB}) })

	const password = "sup3r-secret-password"
	cookiesA := registerForPrivacy(t, app, loginA, loginA+"@example.com", password)
	cookiesB := registerForPrivacy(t, app, loginB, loginB+"@example.com", password)

	shared := createSetWithContent(t, app, cookiesA, fmt.Sprintf("Открытая %d", suffix), "тело", "public")
	hidden := createSetWithContent(t, app, cookiesA, fmt.Sprintf("Тайная %d", suffix), "тело", "private")

	source := createSetWithContent(
		t, app, cookiesB, fmt.Sprintf("Конспект %d", suffix),
		fmt.Sprintf("[[@%s/%s]]", loginA, shared.Slug), "private",
	)

	link := requireSingleLink(t, loadLinks(t, app, cookiesB, source.ID))
	if link.Broken {
		t.Fatalf("кросс-ссылка не разрешилась: %+v", link)
	}
	if link.TargetID != shared.ID || link.TargetSlug != shared.Slug {
		t.Errorf("кросс-ссылка = %+v, ожидалась на сет %d (%q)", link, shared.ID, shared.Slug)
	}
	if link.Own {
		t.Error("кросс-ссылка помечена как своя")
	}
	if link.TargetUserID != shared.UserID {
		t.Errorf("target_user_id = %d, ожидался %d", link.TargetUserID, shared.UserID)
	}

	hiddenSource := createSetWithContent(
		t, app, cookiesB, fmt.Sprintf("Тайный конспект %d", suffix),
		fmt.Sprintf("[[@%s/%s]]", loginA, hidden.Slug), "private",
	)

	link = requireSingleLink(t, loadLinks(t, app, cookiesB, hiddenSource.ID))
	if !link.Broken {
		t.Errorf("ссылка на приватный чужой сет = %+v, ожидалась битой", link)
	}
	if link.ResolvedOnce {
		t.Error("ссылка на приватный чужой сет помечена как ранее разрешённая")
	}
}

func TestPublicSetExposesReadableLinksOnly(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("pl_%d", suffix)
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, []string{login}) })

	const password = "sup3r-secret-password"
	cookies := registerForPrivacy(t, app, login, login+"@example.com", password)

	readable := createSetWithContent(t, app, cookies, fmt.Sprintf("Видимая цель %d", suffix), "тело", "public")
	hidden := createSetWithContent(t, app, cookies, fmt.Sprintf("Личная цель %d", suffix), "тело", "private")

	source := createSetWithContent(
		t, app, cookies, fmt.Sprintf("Витрина %d", suffix),
		fmt.Sprintf("[[%s]] [[%s]]", readable.Title, hidden.Title), "public",
	)

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/sets/" + source.Slug,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("публичная страница = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	link := requireSingleLink(t, body.Links)
	if link.TargetID != readable.ID || link.TargetSlug != readable.Slug {
		t.Errorf("ссылка на публичной странице = %+v, ожидалась на сет %d", link, readable.ID)
	}
	if link.Broken {
		t.Errorf("разрешённая ссылка на публичной странице помечена битой: %+v", link)
	}
}
