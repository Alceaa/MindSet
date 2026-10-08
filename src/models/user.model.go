package models

import "strings"

type User struct {
	ID             int    `json:"id,omitempty" db:"id"`
	Login          string `json:"login" db:"login"`
	Email          string `json:"email" db:"email"`
	Password       string `json:"-" db:"password"`
	Bio            string `json:"bio" db:"bio"`
	Avatar         string `json:"avatar" db:"avatar"`
	DateJoined     string `json:"date_joined" db:"date_joined"`
	EmailVerified  bool   `json:"email_verified" db:"email_verified"`
	TwoFactorEmail bool   `json:"two_factor_email" db:"two_factor_email"`
	Role           string `json:"role" db:"role"`
	BlockedAt      string `json:"blocked_at" db:"blocked_at"`
	BlockedReason  string `json:"blocked_reason" db:"blocked_reason"`
	TokenEpoch     int    `json:"-" db:"token_epoch"`
}

func (u *User) IsAdmin() bool {
	return u != nil && strings.EqualFold(u.Role, RoleAdmin)
}

func (u *User) IsBlocked() bool {
	return u != nil && strings.TrimSpace(u.BlockedAt) != ""
}

const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

type PublicUser struct {
	ID             int    `json:"id"`
	Login          string `json:"login"`
	Email          string `json:"email"`
	Bio            string `json:"bio"`
	Avatar         string `json:"avatar"`
	DateJoined     string `json:"date_joined"`
	EmailVerified  bool   `json:"email_verified"`
	TwoFactorEmail bool   `json:"two_factor_email"`
	Role           string `json:"role"`
}

func (u *User) Public() *PublicUser {
	if u == nil {
		return nil
	}
	return &PublicUser{
		ID:             u.ID,
		Login:          u.Login,
		Email:          u.Email,
		Bio:            u.Bio,
		Avatar:         u.Avatar,
		DateJoined:     u.DateJoined,
		EmailVerified:  u.EmailVerified,
		TwoFactorEmail: u.TwoFactorEmail,
		Role:           u.Role,
	}
}

type Profile struct {
	ID                 int    `json:"id"`
	Login              string `json:"login"`
	Avatar             string `json:"avatar"`
	Bio                string `json:"bio"`
	DateJoined         string `json:"date_joined"`
	LastPublicActivity string `json:"last_public_activity"`
	PublicSetCount     int    `json:"public_set_count"`
	PrivateSetCount    int    `json:"private_set_count"`
	FollowersCount     int    `json:"followers_count"`
	FollowingCount     int    `json:"following_count"`
	IsFollowing        bool   `json:"is_following"`
	IsSelf             bool   `json:"is_self"`
}

type UpdateProfilePayload struct {
	Bio          string `json:"bio" validate:"max=500"`
	RemoveAvatar bool   `json:"remove_avatar"`
}

type RegisterReg struct {
	Login           string `json:"login" validate:"required,min=3,max=32,excludesall=@ "`
	Email           string `json:"email" validate:"required,email,max=254"`
	Password        string `json:"password" validate:"required,min=8,max=72"`
	PasswordConfirm string `json:"password_confirm" validate:"required,min=8,max=72,eqfield=Password"`
	Invite          string `json:"invite" validate:"max=128"`
}

type LoginReg struct {
	Login    string `json:"login" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type ChangePasswordPayload struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=72"`
	ConfirmPassword string `json:"confirm_password" validate:"required,eqfield=NewPassword"`
}

type EmailPayload struct {
	Email string `json:"email" validate:"required,email,max=254"`
}

type ResetPasswordPayload struct {
	Token           string `json:"token" validate:"required"`
	Password        string `json:"password" validate:"required,min=8,max=72"`
	PasswordConfirm string `json:"password_confirm" validate:"required,eqfield=Password"`
}

type VerifyEmailPayload struct {
	Token string `json:"token" validate:"required"`
}

type ConfirmLoginPayload struct {
	Login    string `json:"login" validate:"required"`
	Password string `json:"password" validate:"required"`
	Code     string `json:"code" validate:"required,len=6,numeric"`
}

type TwoFactorPayload struct {
	Enabled  bool   `json:"enabled"`
	Password string `json:"password" validate:"required"`
}
