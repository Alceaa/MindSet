package routes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

type apiProfile struct {
	ID                 int    `json:"id"`
	Login              string `json:"login"`
	Avatar             string `json:"avatar"`
	Bio                string `json:"bio"`
	DateJoined         string `json:"date_joined"`
	LastPublicActivity string `json:"last_public_activity"`
	PublicSetCount     int    `json:"public_set_count"`
	PrivateSetCount    int    `json:"private_set_count"`
	FollowersCount     int    `json:"followers_count"`
	FollowingCount     int    `json:"following_count"`
	IsFollowing        bool   `json:"is_following"`
	IsSelf             bool   `json:"is_self"`
}

type profileResponse struct {
	Profile        *apiProfile `json:"profile"`
	Sets           []apiSet    `json:"sets"`
	Total          int         `json:"total"`
	HasMore        bool        `json:"has_more"`
	IsFollowing    bool        `json:"is_following"`
	FollowersCount int         `json:"followers_count"`
	FollowingCount int         `json:"following_count"`
	User           *apiUser    `json:"user"`
	Avatar         string      `json:"avatar"`
}

func decodeProfile(t *testing.T, raw string) profileResponse {
	t.Helper()
	var parsed profileResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("не удалось разобрать ответ профиля: %v (%s)", err, raw)
	}
	return parsed
}

func callMultipart(t *testing.T, app *fiber.App, path, field, filename string, data []byte, cookies []*http.Cookie) (*http.Response, string) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile(field, filename)
	if err != nil {
		t.Fatalf("создание multipart: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("запись multipart: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("закрытие multipart: %v", err)
	}

	req := httptest.NewRequest(fiber.MethodPost, path, &body)
	req.Header.Set(fiber.HeaderContentType, writer.FormDataContentType())
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("чтение ответа: %v", err)
	}
	_ = resp.Body.Close()
	return resp, string(raw)
}

func samplePNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for x := 0; x < 4; x++ {
		for y := 0; y < 4; y++ {
			img.Set(x, y, color.RGBA{R: 56, G: 139, B: 253, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("кодирование PNG: %v", err)
	}
	return buf.Bytes()
}

func TestProfileFollowAndPrivacy(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("pf_a_%d", suffix)
	viewerLogin := fmt.Sprintf("pf_v_%d", suffix)
	missingLogin := fmt.Sprintf("pf_m_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, viewerLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	viewerCookies := registerSnapshotUser(t, app, viewerLogin, password)

	createPublicSet(t, app, authorCookies, fmt.Sprintf("Публичный %d", suffix), "тело", false)

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Body:    map[string]any{"title": fmt.Sprintf("Приват %d", suffix), "visibility": "private", "content": "секрет"},
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("создание приватного сета = %d: %s", resp.StatusCode, raw)
	}

	// Анонимный профиль.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + authorLogin})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("анонимный профиль = %d: %s", resp.StatusCode, raw)
	}
	profile := decodeProfile(t, raw)
	if profile.Profile == nil {
		t.Fatalf("профиль отсутствует в ответе: %s", raw)
	}
	if profile.Profile.Login != authorLogin {
		t.Fatalf("login профиля = %q, ожидался %q", profile.Profile.Login, authorLogin)
	}
	if profile.Profile.PublicSetCount != 1 {
		t.Fatalf("публичных сетов = %d, ожидалось 1", profile.Profile.PublicSetCount)
	}
	if profile.Profile.PrivateSetCount != 1 {
		t.Fatalf("приватных сетов = %d, ожидалось 1", profile.Profile.PrivateSetCount)
	}
	if profile.Profile.LastPublicActivity == "" {
		t.Fatal("последняя публичная активность не заполнена")
	}
	if profile.Profile.FollowersCount != 0 || profile.Profile.IsFollowing {
		t.Fatalf("аноним не должен видеть подписку: %+v", profile.Profile)
	}
	if strings.Contains(raw, "@example.com") || strings.Contains(raw, "email") {
		t.Fatalf("в публичном профиле утекли приватные поля: %s", raw)
	}

	// Публичные сеты профиля: только public, без приватного.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + authorLogin + "/sets"})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сеты профиля = %d: %s", resp.StatusCode, raw)
	}
	sets := decodeProfile(t, raw)
	if len(sets.Sets) != 1 || sets.Sets[0].Visibility != "public" {
		t.Fatalf("в публичном списке ожидался ровно 1 публичный сет, получено %+v", sets.Sets)
	}
	if sets.Total != 1 {
		t.Fatalf("total сетов профиля = %d, ожидалось 1", sets.Total)
	}

	// Несуществующий профиль.
	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + missingLogin})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("профиль несуществующего пользователя = %d, ожидалось 404", resp.StatusCode)
	}

	authorID := profile.Profile.ID

	// Аноним не может подписаться.
	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodPost, Path: fmt.Sprintf("/users/%d/follow", authorID)})
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("подписка без авторизации = %d, ожидалось 401", resp.StatusCode)
	}

	// Подписка.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodPost, Path: fmt.Sprintf("/users/%d/follow", authorID), Cookies: viewerCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("подписка = %d: %s", resp.StatusCode, raw)
	}
	follow := decodeProfile(t, raw)
	if !follow.IsFollowing || follow.FollowersCount != 1 {
		t.Fatalf("после подписки: is_following=%v followers=%d", follow.IsFollowing, follow.FollowersCount)
	}

	// Повторная подписка идемпотентна.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodPost, Path: fmt.Sprintf("/users/%d/follow", authorID), Cookies: viewerCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("повторная подписка = %d: %s", resp.StatusCode, raw)
	}
	if follow = decodeProfile(t, raw); follow.FollowersCount != 1 {
		t.Fatalf("повторная подписка изменила счётчик: %d", follow.FollowersCount)
	}

	// Профиль глазами подписчика.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + authorLogin, Cookies: viewerCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("профиль для подписчика = %d: %s", resp.StatusCode, raw)
	}
	viewerSees := decodeProfile(t, raw)
	if !viewerSees.Profile.IsFollowing || viewerSees.Profile.FollowersCount != 1 {
		t.Fatalf("подписчик видит is_following=%v followers=%d", viewerSees.Profile.IsFollowing, viewerSees.Profile.FollowersCount)
	}

	// Профиль глазами владельца.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + authorLogin, Cookies: authorCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("свой профиль = %d: %s", resp.StatusCode, raw)
	}
	ownerSees := decodeProfile(t, raw)
	if !ownerSees.Profile.IsSelf {
		t.Fatal("владелец должен видеть is_self=true")
	}

	// Самоподписка запрещена.
	resp, _, _ = call(t, app, callOptions{Method: fiber.MethodPost, Path: fmt.Sprintf("/users/%d/follow", authorID), Cookies: authorCookies})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("самоподписка = %d, ожидалось 400", resp.StatusCode)
	}

	// Отписка.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodDelete, Path: fmt.Sprintf("/users/%d/follow", authorID), Cookies: viewerCookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отписка = %d: %s", resp.StatusCode, raw)
	}
	if unfollow := decodeProfile(t, raw); unfollow.IsFollowing || unfollow.FollowersCount != 0 {
		t.Fatalf("после отписки: is_following=%v followers=%d", unfollow.IsFollowing, unfollow.FollowersCount)
	}
}

func TestProfileAvatarAndBio(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	login := fmt.Sprintf("av_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{login})
		_ = os.RemoveAll("uploads")
	})

	cookies := registerSnapshotUser(t, app, login, password)

	// Обновление биографии.
	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me",
		Body:    map[string]any{"bio": "Привет, это биография"},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("обновление профиля = %d: %s", resp.StatusCode, raw)
	}
	if me := decodeProfile(t, raw); me.User == nil || me.User.Bio != "Привет, это биография" {
		t.Fatalf("биография не сохранилась: %s", raw)
	}

	// /auth/me отдаёт аватар вместе с остальными полями.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/auth/me", Cookies: cookies})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("/auth/me = %d: %s", resp.StatusCode, raw)
	}

	// Валидная загрузка аватара.
	resp, raw = callMultipart(t, app, "/users/me/avatar", "avatar", "a.png", samplePNG(t), cookies)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("загрузка аватара = %d: %s", resp.StatusCode, raw)
	}
	uploaded := decodeProfile(t, raw)
	if !strings.HasPrefix(uploaded.Avatar, "/media/avatars/") || !strings.HasSuffix(uploaded.Avatar, ".png") {
		t.Fatalf("некорректный URL аватара: %q", uploaded.Avatar)
	}
	if uploaded.User == nil || uploaded.User.Avatar != uploaded.Avatar {
		t.Fatalf("профиль не обновил аватар: %+v", uploaded.User)
	}

	// Повторная загрузка перезаписывает единственный файл пользователя.
	resp, raw = callMultipart(t, app, "/users/me/avatar", "avatar", "b.png", samplePNG(t), cookies)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("повторная загрузка аватара = %d: %s", resp.StatusCode, raw)
	}
	files, err := os.ReadDir(filepath.Join("uploads", "avatars"))
	if err != nil {
		t.Fatalf("чтение каталога аватаров: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("на пользователя должен быть ровно один файл аватара, найдено %d", len(files))
	}

	// Не-image файл отклоняется.
	resp, _ = callMultipart(t, app, "/users/me/avatar", "avatar", "evil.png", []byte("not an image at all"), cookies)
	if resp.StatusCode != fiber.StatusUnsupportedMediaType {
		t.Fatalf("невалидный файл = %d, ожидалось 415", resp.StatusCode)
	}

	// Удаление аватара.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me",
		Body:    map[string]any{"bio": "обновлённая биография", "remove_avatar": true},
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("удаление аватара = %d: %s", resp.StatusCode, raw)
	}
	if me := decodeProfile(t, raw); me.User == nil || me.User.Avatar != "" {
		t.Fatalf("аватар не удалён: %s", raw)
	}
}

func TestLoginCaseInsensitiveAndUnique(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	mixed := fmt.Sprintf("CaseUser_%d", suffix)
	lower := strings.ToLower(mixed)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{mixed})
	})

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            mixed,
			"email":            mixed + "@example.com",
			"password":         password,
			"password_confirm": password,
		},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("регистрация = %d: %s", resp.StatusCode, raw)
	}

	// Тот же логин в другом регистре занят.
	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            lower,
			"email":            lower + "@example.com",
			"password":         password,
			"password_confirm": password,
		},
	})
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("регистр-дубликат = %d, ожидалось 409: %s", resp.StatusCode, raw)
	}

	// Вход по логину в другом регистре успешен, отображается исходный регистр.
	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": lower, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход по нижнему регистру = %d: %s", resp.StatusCode, raw)
	}
	if body.User == nil || body.User.Login != mixed {
		t.Fatalf("логин должен сохранять исходный регистр %q, получено %+v", mixed, body.User)
	}

	// Профиль открывается по логину в любом регистре.
	resp, _, raw = call(t, app, callOptions{Method: fiber.MethodGet, Path: "/public/users/" + lower})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("профиль по нижнему регистру = %d: %s", resp.StatusCode, raw)
	}
	if prof := decodeProfile(t, raw); prof.Profile == nil || prof.Profile.Login != mixed {
		t.Fatalf("профиль должен вернуть исходный регистр %q", mixed)
	}
}
