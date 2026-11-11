package models

const (
	APITokenMaxPerUser     = 20
	APITokenMaxExpiryDays  = 730
	APITokenTitleMaxLength = 60
)

var APITokenExpiryChoices = []int{0, 30, 90, 365}

type APIToken struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	Prefix     string `json:"prefix"`
	CreatedAt  string `json:"created_at"`
	LastUsedAt string `json:"last_used_at"`
	ExpiresAt  string `json:"expires_at"`
	Expired    bool   `json:"expired"`
}

type APITokenPayload struct {
	Title         string `json:"title" validate:"required,min=1,max=60"`
	ExpiresInDays int    `json:"expires_in_days" validate:"min=0,max=730"`
}

func ValidAPITokenExpiry(days int) bool {
	return days >= 0 && days <= APITokenMaxExpiryDays
}
