package models

import "strings"

// Категории уведомлений. Значения попадают в базу и в настройки пользователя,
// поэтому менять их строки нельзя — только добавлять новые.
const (
	NotificationNewFollower = "new_follower"
	NotificationSetLike     = "set_like"
	NotificationSetComment  = "set_comment"
	NotificationInviteUsed  = "invite_used"
	NotificationSetRemoved  = "set_removed"
)

// NotificationKinds — порядок и подписи для настроек.
var NotificationKinds = []struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
}{
	{NotificationNewFollower, "Новые подписчики", "Когда на вас подписываются"},
	{NotificationSetLike, "Лайки сетов", "Когда кому-то понравился ваш сет"},
	{NotificationSetComment, "Комментарии", "Когда оставляют комментарий к вашему сету"},
	{NotificationInviteUsed, "Приглашения", "Когда по вашей ссылке зарегистрировались"},
	{NotificationSetRemoved, "Модерация", "Когда ваш сет удалён администратором"},
}

// Notification — то, что видит пользователь в списке. Поля актора и сета лежат
// в payload, чтобы уведомление читалось даже после переименования или удаления сета.
type Notification struct {
	ID         int    `json:"id"`
	UserID     int    `json:"-"`
	Kind       string `json:"kind"`
	Count      int    `json:"count"`
	ActorID    int    `json:"-"`
	ActorLogin string `json:"actor_login"`
	SetID      int    `json:"set_id"`
	SetSlug    string `json:"set_slug"`
	SetTitle   string `json:"set_title"`
	Excerpt    string `json:"excerpt"`
	ReadAt     string `json:"read_at"`
	CreatedAt  string `json:"created_at"`
}

func (n *Notification) IsKnownKind() bool {
	for _, kind := range NotificationKinds {
		if kind.Kind == n.Kind {
			return true
		}
	}
	return false
}

type NotificationPrefsPayload struct {
	Kind    string `json:"kind" validate:"required,oneof=new_follower set_like set_comment invite_used set_removed"`
	Enabled bool   `json:"enabled"`
}

// NormalizeKind приводит значение из запроса к известной категории.
func NormalizeKind(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
