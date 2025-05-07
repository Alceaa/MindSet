package models

type User struct {
	ID         int    `json:"id,omitempty" db:"id"`
	Login      string `json:"login" db:"login"`
	Email      string `json:"email" db:"email"`
	Password   string `json:"password" db:"password"`
	Name       string `db:"name" json:"name"`
	Bio        string `db:"bio,omitempty" json:"bio"`
	DateJoined string `db:"date_joined" json:"date_joined"`
}

type RegisterReg struct {
	Login           string `json:"login" db:"login" validate:"required"`
	Email           string `json:"email" db:"email" validate:"required"`
	Name            string `json:"name" db:"name" validate:"required"`
	Password        string `json:"password" validate:"required,min=8"`
	PasswordConfirm string `json:"password_confirm" validate:"required,min=8"`
}

type LoginReg struct {
	Login    string `json:"login,omitempty" db:"login" validate:"required"`
	Password string `json:"password" validate:"required"`
}
