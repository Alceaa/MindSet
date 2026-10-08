package models

type Visibility string

const (
	VisibilityPrivate  Visibility = "private"
	VisibilityUnlisted Visibility = "unlisted"
	VisibilityPublic   Visibility = "public"
)

func (v Visibility) Valid() bool {
	switch v {
	case VisibilityPrivate, VisibilityUnlisted, VisibilityPublic:
		return true
	}
	return false
}

func (v Visibility) ReadableByOthers() bool {
	return v == VisibilityPublic || v == VisibilityUnlisted
}

type Set struct {
	ID            int        `json:"id,omitempty" db:"id"`
	UserID        int        `json:"user_id" db:"user_id"`
	Title         string     `json:"title" db:"title"`
	TitleKey      string     `json:"-" db:"title_key"`
	Slug          string     `json:"slug" db:"slug"`
	Visibility    Visibility `json:"visibility" db:"visibility"`
	ForbidCopies  bool       `json:"forbid_copies" db:"forbid_copies"`
	Description   string     `json:"description" db:"description"`
	Content       string     `json:"content,omitempty" db:"content"`
	DateCreated   string     `json:"date_created" db:"date_created"`
	LastActivity  string     `json:"last_activity" db:"last_activity"`
	Preview       string     `json:"preview,omitempty" db:"-"`
	LikesCount    int        `json:"likes_count" db:"-"`
	CommentsCount int        `json:"comments_count" db:"-"`
	IsLiked       bool       `json:"is_liked" db:"-"`
	Author        *SetAuthor `json:"author,omitempty" db:"-"`
}

type SetAuthor struct {
	Login  string `json:"login"`
	Avatar string `json:"avatar,omitempty"`
}

type SnapshotState string

const (
	SnapshotStateLive       SnapshotState = "live"
	SnapshotStateFrozen     SnapshotState = "frozen"
	SnapshotStateAttention  SnapshotState = "attention"
	SnapshotStateSourceGone SnapshotState = "source_gone"
	SnapshotStateHidden     SnapshotState = "hidden"
	SnapshotStateSuppressed SnapshotState = "suppressed"
)

type SavedSet struct {
	ID           int           `json:"id" db:"id"`
	OwnerUserID  int           `json:"owner_user_id" db:"owner_user_id"`
	SetID        int           `json:"set_id,omitempty" db:"set_id"`
	SourceUserID int           `json:"source_user_id,omitempty" db:"source_user_id"`
	SourceLogin  string        `json:"source_login" db:"source_login"`
	SourceSlug   string        `json:"source_slug" db:"source_slug"`
	Title        string        `json:"title" db:"title"`
	Description  string        `json:"description" db:"description"`
	Content      string        `json:"content,omitempty" db:"content"`
	Frozen       bool          `json:"frozen" db:"frozen"`
	FrozenAuto   bool          `json:"frozen_auto" db:"frozen_auto"`
	TombstoneID  *int          `json:"tombstone_id,omitempty" db:"tombstone_id"`
	RevokedAt    string        `json:"revoked_at,omitempty" db:"revoked_at"`
	DateSaved    string        `json:"date_saved" db:"date_saved"`
	LastUpdate   string        `json:"last_update" db:"last_update"`
	State        SnapshotState `json:"state" db:"-"`
	LiveTitle    string        `json:"live_title,omitempty" db:"-"`
	LiveSlug     string        `json:"live_slug,omitempty" db:"-"`
	LiveActivity string        `json:"live_last_activity,omitempty" db:"-"`
	SnapshotID   int           `json:"snapshot_id,omitempty" db:"-"`
}

type SavedSetPayload struct {
	Slug  string `json:"slug" validate:"required,max=200"`
	Login string `json:"login" validate:"max=100"`
}

type SetPayload struct {
	Title        string     `json:"title" validate:"required,min=1,max=100"`
	Description  string     `json:"description" validate:"max=250"`
	Visibility   Visibility `json:"visibility" validate:"omitempty,oneof=private unlisted public"`
	Content      string     `json:"content" validate:"max=200000"`
	ForbidCopies bool       `json:"forbid_copies"`
}
