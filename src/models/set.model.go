package models

type Set struct {
	ID           int    `json:"id,omitempty" db:"id"`
	Title        string `db:"title" json:"title"`
	Description  string `db:"description,omitempty" json:"description"`
	DateCreated  string `db:"date_created" json:"date_created"`
	LastActivity string `db:"last_activity" json:"last_activity"`
}
