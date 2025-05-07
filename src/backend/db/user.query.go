package db

import (
	"context"
	"fmt"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func CreateUser(ctx context.Context, user *models.User) error {
	query := `INSERT INTO users (login, email, password, name, data_joined) VALUES 
	(@login, @email, @password, @name, @data_joined)`
	args := pgx.NamedArgs{
		"login":       user.Login,
		"email":       user.Email,
		"password":    user.Password,
		"name":        user.Name,
		"data_joined": user.DateJoined,
	}
	err := pgInstance.db.QueryRow(ctx, query, args)
	if err != nil {
		return fmt.Errorf("Error while creating user: %w", err)
	}
	return nil
}

func GetUserByEmail(ctx context.Context, email string, user *models.User) error {
	query := `SELECT * FROM users WHERE email = @email;`
	args := pgx.NamedArgs{
		"email": email,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	if err != nil {
		return fmt.Errorf("No user with this email: %w", err)
	}
	return nil
}

func GetUserByUsername(ctx context.Context, username string, user *models.User) error {
	query := `SELECT * FROM users WHERE username = @username;`
	args := pgx.NamedArgs{
		"username": username,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	if err != nil {
		return fmt.Errorf("No user with this username: %w", err)
	}
	return nil
}

func GetUserById(ctx context.Context, id string, user *models.User) error {
	query := `SELECT * FROM users WHERE id = @id;`
	args := pgx.NamedArgs{
		"id": id,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	if err != nil {
		return fmt.Errorf("No user with this id: %w", err)
	}
	return nil
}
