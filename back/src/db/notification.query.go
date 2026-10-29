package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const notificationExcerptLimit = 120

type notificationPayload struct {
	ActorLogin string `json:"actor_login,omitempty"`
	SetID      int    `json:"set_id,omitempty"`
	SetSlug    string `json:"set_slug,omitempty"`
	SetTitle   string `json:"set_title,omitempty"`
	Excerpt    string `json:"excerpt,omitempty"`
}

func truncateExcerpt(value string) string {
	runes := []rune(value)
	if len(runes) <= notificationExcerptLimit {
		return value
	}
	return string(runes[:notificationExcerptLimit]) + "…"
}

func notificationPrefsFromRaw(raw []byte) map[string]bool {
	prefs := map[string]bool{}
	if len(raw) == 0 {
		return prefs
	}
	_ = json.Unmarshal(raw, &prefs)
	return prefs
}

// effectiveNotificationPrefs превращает «храним выключенное» в карту «категория → включено».
// Ключ в настройках означает «выключено», значение всегда false — важно именно наличие ключа.
func effectiveNotificationPrefs(disabled map[string]bool) map[string]bool {
	prefs := make(map[string]bool, len(models.NotificationKinds))
	for _, kind := range models.NotificationKinds {
		_, off := disabled[kind.Kind]
		prefs[kind.Kind] = !off
	}
	return prefs
}

// NotificationKindEnabled проверяет настройки получателя перед записью уведомления.
func NotificationKindEnabled(ctx context.Context, tx pgx.Tx, userID int, kind string) (bool, error) {
	var raw []byte
	err := tx.QueryRow(ctx,
		`SELECT notification_prefs FROM users WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, ErrNotFound
		}
		return false, fmt.Errorf("notification prefs: %w", err)
	}
	return !notificationPrefsDisabled(notificationPrefsFromRaw(raw), kind), nil
}

func notificationPrefsDisabled(disabled map[string]bool, kind string) bool {
	_, off := disabled[kind]
	return off
}

// CreateNotification пишет уведомление или увеличивает счётчик непрочитанного,
// если такое же (получатель + категория + актор + объект) уже ждёт прочтения.
func CreateNotification(ctx context.Context, tx pgx.Tx, notification *models.Notification) error {
	payload, err := json.Marshal(notificationPayload{
		ActorLogin: notification.ActorLogin,
		SetID:      notification.SetID,
		SetSlug:    notification.SetSlug,
		SetTitle:   notification.SetTitle,
		Excerpt:    truncateExcerpt(notification.Excerpt),
	})
	if err != nil {
		return fmt.Errorf("notification payload: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO notifications (user_id, kind, actor_id, target_id, payload)
		 VALUES (@user_id, @kind, @actor_id, @target_id, @payload)
		 ON CONFLICT (user_id, kind, actor_id, target_id) WHERE read_at IS NULL
		 DO UPDATE SET
		     count = notifications.count + 1,
		     payload = EXCLUDED.payload,
		     created_at = now()`,
		pgx.NamedArgs{
			"user_id":   notification.UserID,
			"kind":      notification.Kind,
			"actor_id":  notificationGroupActor(notification),
			"target_id": notification.SetID,
			"payload":   payload,
		},
	)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}

// notificationGroupActor — часть ключа группировки. Лайки и комментарии объединяем
// по объекту (сколько людей отреагировало), остальные события — по конкретному человеку.
func notificationGroupActor(notification *models.Notification) int {
	switch notification.Kind {
	case models.NotificationSetLike, models.NotificationSetComment:
		return 0
	default:
		return notification.ActorID
	}
}

// NotifyRecipient пишет уведомление получателю: пропускает свои же действия
// (свои лайки и комментарии не уведомляют) и уважает настройки категории.
func NotifyRecipient(ctx context.Context, tx pgx.Tx, notification *models.Notification) error {
	if notification.UserID <= 0 || notification.UserID == notification.ActorID {
		return nil
	}

	enabled, err := NotificationKindEnabled(ctx, tx, notification.UserID, notification.Kind)
	switch {
	case errors.Is(err, ErrNotFound):
		return nil
	case err != nil:
		return err
	case !enabled:
		return nil
	}

	return CreateNotification(ctx, tx, notification)
}

func ListNotifications(ctx context.Context, userID, limit, offset int) ([]*models.Notification, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := conn.Query(ctx,
		`SELECT id, kind, count, actor_id,
		        coalesce(payload ->> 'actor_login', '') AS actor_login,
		        coalesce((payload ->> 'set_id')::int, 0) AS set_id,
		        coalesce(payload ->> 'set_slug', '') AS set_slug,
		        coalesce(payload ->> 'set_title', '') AS set_title,
		        coalesce(payload ->> 'excerpt', '') AS excerpt,
		        coalesce(to_char(read_at AT TIME ZONE 'UTC', `+isoUTCTimeFormat+`), '') AS read_at,
		        to_char(created_at AT TIME ZONE 'UTC', `+isoUTCTimeFormat+`) AS created_at
		 FROM notifications
		 WHERE user_id = @user_id
		 ORDER BY created_at DESC, id DESC
		 LIMIT @limit OFFSET @offset`,
		pgx.NamedArgs{"user_id": userID, "limit": limit, "offset": offset},
	)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	items := make([]*models.Notification, 0, limit)
	for rows.Next() {
		var item models.Notification
		if err := rows.Scan(
			&item.ID,
			&item.Kind,
			&item.Count,
			&item.ActorID,
			&item.ActorLogin,
			&item.SetID,
			&item.SetSlug,
			&item.SetTitle,
			&item.Excerpt,
			&item.ReadAt,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		items = append(items, &item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	return items, nil
}

func UnreadNotificationCount(ctx context.Context, userID int) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var count int
	err = conn.QueryRow(ctx,
		`SELECT count(*) FROM notifications WHERE user_id = @user_id AND read_at IS NULL`,
		pgx.NamedArgs{"user_id": userID},
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count notifications: %w", err)
	}
	return count, nil
}

// MarkNotificationRead отмечает уведомление прочитанным. Чужое или несуществующее — ErrNotFound.
func MarkNotificationRead(ctx context.Context, userID, notificationID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`UPDATE notifications SET read_at = coalesce(read_at, now())
		 WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": notificationID, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func MarkAllNotificationsRead(ctx context.Context, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`UPDATE notifications SET read_at = now()
		 WHERE user_id = @user_id AND read_at IS NULL`,
		pgx.NamedArgs{"user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

// NotificationPrefs отдаёт все категории с эффективным значением (включено/выключено).
func NotificationPrefs(ctx context.Context, userID int) (map[string]bool, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var raw []byte
	err = conn.QueryRow(ctx,
		`SELECT notification_prefs FROM users WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("notification prefs: %w", err)
	}

	return effectiveNotificationPrefs(notificationPrefsFromRaw(raw)), nil
}

func SetNotificationPref(ctx context.Context, userID int, kind string, enabled bool) (map[string]bool, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var raw []byte
	err = conn.QueryRow(ctx,
		`UPDATE users
		 SET notification_prefs = CASE
		         WHEN @enabled THEN notification_prefs - @kind
		         ELSE notification_prefs || jsonb_build_object(@kind, false)
		     END
		 WHERE id = @id
		 RETURNING notification_prefs`,
		pgx.NamedArgs{"id": userID, "kind": kind, "enabled": enabled},
	).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set notification prefs: %w", err)
	}

	return effectiveNotificationPrefs(notificationPrefsFromRaw(raw)), nil
}
