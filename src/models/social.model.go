package models

type Comment struct {
	ID          int    `json:"id"`
	SetID       int    `json:"set_id"`
	UserID      int    `json:"user_id"`
	Login       string `json:"login"`
	Avatar      string `json:"avatar"`
	Body        string `json:"body"`
	DateCreated string `json:"date_created"`
}

type CommentPayload struct {
	Body string `json:"body" validate:"required,min=1,max=2000"`
}

type Announcement struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	DatePosted string `json:"date_posted"`
}
