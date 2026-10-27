package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

type apiNotification struct {
	ID         int    `json:"id"`
	Kind       string `json:"kind"`
	Count      int    `json:"count"`
	ActorLogin string `json:"actor_login"`
	SetSlug    string `json:"set_slug"`
	SetTitle   string `json:"set_title"`
	Excerpt    string `json:"excerpt"`
	ReadAt     string `json:"read_at"`
	CreatedAt  string `json:"created_at"`
}

type notificationsResponse struct {
	Notifications []apiNotification `json:"notifications"`
	Unread        int               `json:"unread"`
	HasMore       bool              `json:"has_more"`
}

type prefsResponse struct {
	Prefs map[string]bool `json:"prefs"`
}

func notificationsOf(t *testing.T, app *fiber.App, cookies []*http.Cookie) notificationsResponse {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/notifications",
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("список уведомлений = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	var parsed notificationsResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("разбор уведомлений: %v (%s)", err, raw)
	}
	return parsed
}

func unreadOf(t *testing.T, app *fiber.App, cookies []*http.Cookie) int {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/notifications/unread",
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("счётчик непрочитанных = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}

	var parsed struct {
		Unread int `json:"unread"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("разбор счётчика: %v (%s)", err, raw)
	}
	return parsed.Unread
}

func findNotification(items []apiNotification, kind string) *apiNotification {
	for index := range items {
		if items[index].Kind == kind {
			return &items[index]
		}
	}
	return nil
}

func likeSet(t *testing.T, app *fiber.App, slug string, cookies []*http.Cookie) {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/public/sets/" + slug + "/like",
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("лайк сета %s = %d, ожидалось 200: %s", slug, resp.StatusCode, raw)
	}
}

func unlikeSet(t *testing.T, app *fiber.App, slug string, cookies []*http.Cookie) {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodDelete,
		Path:    "/public/sets/" + slug + "/like",
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("снятие лайка сета %s = %d, ожидалось 200: %s", slug, resp.StatusCode, raw)
	}
}

func commentSet(t *testing.T, app *fiber.App, slug, body string, cookies []*http.Cookie) {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/public/sets/" + slug + "/comments",
		Cookies: cookies,
		Body:    map[string]string{"body": body},
	})
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("комментарий к сету %s = %d, ожидалось 201: %s", slug, resp.StatusCode, raw)
	}
}

func followUser(t *testing.T, app *fiber.App, userID int, cookies []*http.Cookie) {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/users/%d/follow", userID),
		Cookies: cookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("подписка на %d = %d, ожидалось 200: %s", userID, resp.StatusCode, raw)
	}
}

func userIDOf(t *testing.T, app *fiber.App, login string) int {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodGet,
		Path:   "/public/users/" + login,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("публичный профиль %s = %d: %s", login, resp.StatusCode, raw)
	}

	var parsed struct {
		Profile struct {
			ID int `json:"id"`
		} `json:"profile"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("разбор профиля: %v (%s)", err, raw)
	}
	if parsed.Profile.ID == 0 {
		t.Fatalf("в ответе нет идентификатора пользователя: %s", raw)
	}
	return parsed.Profile.ID
}

func dbURL() string {
	return utils.Config().DBUrl
}

func TestNotificationsOnLikeCommentAndFollow(t *testing.T) {
	app := setupApp(t)

	authorLogin := uniqueTestLogin(t, "nauth")
	actorLogin := uniqueTestLogin(t, "nactor")
	secondLogin := uniqueTestLogin(t, "nactor2")
	t.Cleanup(func() { deleteUsers(t, dbURL(), []string{authorLogin, actorLogin, secondLogin}) })

	authorCookies := registerVerified(t, app, authorLogin, authorLogin+"@example.org", "notif-password-123")
	actorCookies := registerVerified(t, app, actorLogin, actorLogin+"@example.org", "notif-password-123")
	secondCookies := registerVerified(t, app, secondLogin, secondLogin+"@example.org", "notif-password-123")

	set := createSetForPrivacy(t, app, authorCookies, uniqueTestLogin(t, "Notif set"), "public")

	likeSet(t, app, set.Slug, actorCookies)
	likeSet(t, app, set.Slug, actorCookies)

	list := notificationsOf(t, app, authorCookies)
	if list.Unread != 1 {
		t.Fatalf("после двух лайков одного человека непрочитанных = %d, ожидалось 1", list.Unread)
	}

	// Лайк от другого человека попадает в то же уведомление и увеличивает счётчик.
	likeSet(t, app, set.Slug, secondCookies)

	list = notificationsOf(t, app, authorCookies)
	if list.Unread != 1 {
		t.Fatalf("лайк второго человека создал отдельное уведомление: %+v", list.Notifications)
	}

	like := findNotification(list.Notifications, "set_like")
	if like == nil {
		t.Fatalf("нет уведомления о лайке: %+v", list.Notifications)
	}
	if like.Count != 2 {
		t.Fatalf("лайки не сгруппировались: count = %d, ожидалось 2", like.Count)
	}
	if like.ActorLogin != secondLogin {
		t.Fatalf("в уведомлении актор %q, ожидался последний лайкнувший %q", like.ActorLogin, secondLogin)
	}
	if like.SetTitle != set.Title || like.SetSlug != set.Slug {
		t.Fatalf("в уведомлении не тот сет: %+v", like)
	}

	commentSet(t, app, set.Slug, "Полезный сет, спасибо!", actorCookies)

	list = notificationsOf(t, app, authorCookies)
	if list.Unread != 2 {
		t.Fatalf("после комментария непрочитанных = %d, ожидалось 2", list.Unread)
	}
	comment := findNotification(list.Notifications, "set_comment")
	if comment == nil {
		t.Fatalf("нет уведомления о комментарии: %+v", list.Notifications)
	}
	if comment.Excerpt == "" {
		t.Fatalf("в уведомлении о комментарии нет текста: %+v", comment)
	}

	followUser(t, app, userIDOf(t, app, authorLogin), actorCookies)

	list = notificationsOf(t, app, authorCookies)
	if findNotification(list.Notifications, "new_follower") == nil {
		t.Fatalf("нет уведомления о подписчике: %+v", list.Notifications)
	}

	// Свои лайки и комментарии не уведомляют.
	ownSet := createSetForPrivacy(t, app, authorCookies, uniqueTestLogin(t, "Own notif set"), "public")
	likeSet(t, app, ownSet.Slug, authorCookies)
	commentSet(t, app, ownSet.Slug, "Своя же заметка, не уведомляй", authorCookies)

	after := notificationsOf(t, app, authorCookies)
	if len(after.Notifications) != len(list.Notifications) {
		t.Fatalf("свои действия создали уведомления: было %d, стало %d",
			len(list.Notifications), len(after.Notifications))
	}

	// У актора список пуст.
	if actorList := notificationsOf(t, app, actorCookies); len(actorList.Notifications) != 0 {
		t.Fatalf("у актора появились уведомления: %+v", actorList.Notifications)
	}
}

func TestNotificationsReadFlow(t *testing.T) {
	app := setupApp(t)

	authorLogin := uniqueTestLogin(t, "nread")
	actorLogin := uniqueTestLogin(t, "nreader")
	strangerLogin := uniqueTestLogin(t, "nstr")
	t.Cleanup(func() { deleteUsers(t, dbURL(), []string{authorLogin, actorLogin, strangerLogin}) })

	authorCookies := registerVerified(t, app, authorLogin, authorLogin+"@example.org", "notif-password-123")
	actorCookies := registerVerified(t, app, actorLogin, actorLogin+"@example.org", "notif-password-123")
	strangerCookies := registerVerified(t, app, strangerLogin, strangerLogin+"@example.org", "notif-password-123")

	set := createSetForPrivacy(t, app, authorCookies, uniqueTestLogin(t, "Read set"), "public")
	likeSet(t, app, set.Slug, actorCookies)
	commentSet(t, app, set.Slug, "Первый комментарий", actorCookies)

	list := notificationsOf(t, app, authorCookies)
	if len(list.Notifications) != 2 {
		t.Fatalf("уведомлений = %d, ожидалось 2: %+v", len(list.Notifications), list.Notifications)
	}

	// Чужое уведомление отметить нельзя.
	resp, _, _ := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/notifications/%d/read", list.Notifications[0].ID),
		Cookies: strangerCookies,
	})
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("отметка чужого уведомления = %d, ожидалось 404", resp.StatusCode)
	}

	// Своё отмечается, счётчик уменьшается.
	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    fmt.Sprintf("/notifications/%d/read", list.Notifications[0].ID),
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отметка уведомления = %d: %s", resp.StatusCode, raw)
	}
	if unread := unreadOf(t, app, authorCookies); unread != 1 {
		t.Fatalf("после отметки непрочитанных = %d, ожидалось 1", unread)
	}

	// «Прочитать все» обнуляет счётчик.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/notifications/read-all",
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("отметка всех = %d: %s", resp.StatusCode, raw)
	}
	if unread := unreadOf(t, app, authorCookies); unread != 0 {
		t.Fatalf("после отметки всех непрочитанных = %d, ожидалось 0", unread)
	}

	// Новый лайк после прочтения создаёт новое уведомление с count = 1.
	unlikeSet(t, app, set.Slug, actorCookies)
	likeSet(t, app, set.Slug, actorCookies)
	fresh := notificationsOf(t, app, authorCookies)
	if fresh.Unread != 1 {
		t.Fatalf("новый лайк не создал непрочитанное: unread = %d", fresh.Unread)
	}
	if like := findNotification(fresh.Notifications, "set_like"); like == nil || like.Count != 1 {
		t.Fatalf("ожидалось новое уведомление о лайке с count = 1: %+v", fresh.Notifications)
	}
}

func TestNotificationPrefsRespected(t *testing.T) {
	app := setupApp(t)

	authorLogin := uniqueTestLogin(t, "nprefs")
	actorLogin := uniqueTestLogin(t, "nprefa")
	t.Cleanup(func() { deleteUsers(t, dbURL(), []string{authorLogin, actorLogin}) })

	authorCookies := registerVerified(t, app, authorLogin, authorLogin+"@example.org", "notif-password-123")
	actorCookies := registerVerified(t, app, actorLogin, actorLogin+"@example.org", "notif-password-123")

	// По умолчанию включено всё.
	resp, _, raw := call(t, app, callOptions{
		Method:  fiber.MethodGet,
		Path:    "/users/me/notification-prefs",
		Cookies: authorCookies,
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("настройки уведомлений = %d: %s", resp.StatusCode, raw)
	}
	var prefs prefsResponse
	if err := json.Unmarshal([]byte(raw), &prefs); err != nil {
		t.Fatalf("разбор настроек: %v (%s)", err, raw)
	}
	if !prefs.Prefs["set_like"] {
		t.Fatalf("лайки должны быть включены по умолчанию: %+v", prefs.Prefs)
	}

	// Отключаем лайки — уведомлений нет.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/notification-prefs",
		Cookies: authorCookies,
		Body:    map[string]any{"kind": "set_like", "enabled": false},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("сохранение настроек = %d: %s", resp.StatusCode, raw)
	}

	set := createSetForPrivacy(t, app, authorCookies, uniqueTestLogin(t, "Prefs set"), "public")
	likeSet(t, app, set.Slug, actorCookies)

	if list := notificationsOf(t, app, authorCookies); len(list.Notifications) != 0 {
		t.Fatalf("выключенная категория всё равно уведомила: %+v", list.Notifications)
	}

	// Включаем обратно — уведомление приходит.
	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/notification-prefs",
		Cookies: authorCookies,
		Body:    map[string]any{"kind": "set_like", "enabled": true},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("включение настроек = %d: %s", resp.StatusCode, raw)
	}

	unlikeSet(t, app, set.Slug, actorCookies)
	likeSet(t, app, set.Slug, actorCookies)
	if like := findNotification(notificationsOf(t, app, authorCookies).Notifications, "set_like"); like == nil {
		t.Fatalf("после включения категории уведомление не пришло")
	}

	// Неизвестная категория отклоняется.
	resp, _, _ = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    "/users/me/notification-prefs",
		Cookies: authorCookies,
		Body:    map[string]any{"kind": "unknown_kind", "enabled": false},
	})
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("неизвестная категория = %d, ожидалось 400", resp.StatusCode)
	}
}

