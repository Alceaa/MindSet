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

func Visibilities() []Visibility {
	return []Visibility{VisibilityPrivate, VisibilityUnlisted, VisibilityPublic}
}

type Set struct {
	ID           int        `json:"id,omitempty" db:"id"`
	UserID       int        `json:"user_id" db:"user_id"`
	Title        string     `json:"title" db:"title"`
	TitleKey     string     `json:"-" db:"title_key"`
	Slug         string     `json:"slug" db:"slug"`
	Visibility   Visibility `json:"visibility" db:"visibility"`
	Description  string     `json:"description" db:"description"`
	Content      string     `json:"content,omitempty" db:"content"`
	DateCreated  string     `json:"date_created" db:"date_created"`
	LastActivity string     `json:"last_activity" db:"last_activity"`
	Author       *SetAuthor `json:"author,omitempty" db:"-"`
}

type SetAuthor struct {
	Login string `json:"login"`
}

type SetPayload struct {
	Title       string     `json:"title" validate:"required,min=1,max=100"`
	Description string     `json:"description" validate:"max=250"`
	Visibility  Visibility `json:"visibility" validate:"omitempty,oneof=private unlisted public"`
	Content     string     `json:"content" validate:"max=200000"`
}
