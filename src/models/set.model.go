package models

type Set struct {
	ID           int    `json:"id,omitempty" db:"id"`
	UserID       int    `json:"user_id" db:"user_id"`
	Title        string `json:"title" db:"title"`
	Description  string `json:"description" db:"description"`
	Content      string `json:"content,omitempty" db:"content"`
	DateCreated  string `json:"date_created" db:"date_created"`
	LastActivity string `json:"last_activity" db:"last_activity"`
}

type SetPayload struct {
	Title       string `json:"title" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"max=250"`
	Content     string `json:"content" validate:"max=200000"`
}
