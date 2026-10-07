package models

type User struct {
	ID         int    `json:"id,omitempty" db:"id"`
	Login      string `json:"login" db:"login"`
	Email      string `json:"email" db:"email"`
	Password   string `json:"-" db:"password"`
	Bio        string `json:"bio" db:"bio"`
	Avatar     string `json:"avatar" db:"avatar"`
	DateJoined string `json:"date_joined" db:"date_joined"`
}

type PublicUser struct {
	ID         int    `json:"id"`
	Login      string `json:"login"`
	Email      string `json:"email"`
	Bio        string `json:"bio"`
	Avatar     string `json:"avatar"`
	DateJoined string `json:"date_joined"`
}

func (u *User) Public() *PublicUser {
	if u == nil {
		return nil
	}
	return &PublicUser{
		ID:         u.ID,
		Login:      u.Login,
		Email:      u.Email,
		Bio:        u.Bio,
		Avatar:     u.Avatar,
		DateJoined: u.DateJoined,
	}
}

// Profile — публичное представление чужого профиля (без email и пароля).
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
}

type LoginReg struct {
	Login    string `json:"login" validate:"required"`
	Password string `json:"password" validate:"required"`
}
