package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
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
	Description  string `json:"description"`
	Content      string `json:"content"`
	DateCreated  string `json:"date_created"`
	LastActivity string `json:"last_activity"`
}

type apiResponse struct {
	Status  string            `json:"status"`
	Message string            `json:"message"`
	Errors  []validationError `json:"errors"`
	User    *apiUser          `json:"user"`
	Sets    []apiSet          `json:"sets"`
	Set     *apiSet           `json:"set"`
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

func TestAuthAndSetsFlow(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	// Логин ограничен 32 символами, поэтому суффикс короткий.
	login := fmt.Sprintf("it_%d", suffix)
	email := login + "@example.com"
	const password = "sup3r-secret-password"

	logins := []string{login, login + "_alt"}
	t.Cleanup(func() { deleteUsers(t, cfg.DBUrl, logins) })

	// --- 1. Анонимный доступ ---
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

	// --- 2. Валидация регистрации ---
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

	// --- 3. Успешная регистрация ---
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
	// Хеш пароля не должен попадать в ответ.
	if strings.Contains(raw, `"password"`) || strings.Contains(raw, "$2a$") {
		t.Fatalf("ответ регистрации содержит данные пароля: %s", raw)
	}
	userID := body.User.ID

	// --- 4. Повторная регистрация ---
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

	// --- 5. Неверные учётные данные ---
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

	// --- 6. Вход: cookie с токенами ---
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

	// --- 7. Текущий пользователь по cookie и по Bearer ---
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

	// --- 8. Сеты ---
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

	// --- 9. Изоляция пользователей ---
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

	// --- 9.1 Содержимое сета: создание, чтение, обновление, удаление ---
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

	// --- 10. Продление сессии ---
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

	// --- 11. Тело запроса не в формате JSON ---
	resp, _, _ = call(t, app, callOptions{
		Method:      fiber.MethodPost,
		Path:        "/auth/login",
		Body:        map[string]string{"login": login, "password": password},
		ContentType: fiber.MIMETextPlain,
	})
	if resp.StatusCode != fiber.StatusUnsupportedMediaType {
		t.Fatalf("не-JSON тело = %d, ожидалось 415", resp.StatusCode)
	}

	// --- 12. Выход ---
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

	// Подделанный токен не проходит проверку подписи.
	resp, _, _ = call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/auth/me",
		Bearer: accessCookie.Value + "broken",
	})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("поддельный токен = %d, ожидалось 401", resp.StatusCode)
	}
}
