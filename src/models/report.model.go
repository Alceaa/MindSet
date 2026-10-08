package models

type BugReportPayload struct {
	Topic   string `json:"topic" validate:"required,min=3,max=120"`
	Message string `json:"message" validate:"required,min=10,max=2000"`
	Page    string `json:"page" validate:"max=200"`
}

type InvitePayload struct {
	Note string `json:"note" validate:"max=200"`
	Days int    `json:"days" validate:"omitempty,min=1,max=90"`
}
