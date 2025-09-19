package db

import (
	"context"
	"fmt"
	"log"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func CreateUser(ctx context.Context, user *models.User) (*models.User, error) {
	query := `INSERT INTO users (login, email, password,  date_joined) VALUES 
	(@login, @email, @password, @date_joined) RETURNING id`
	args := pgx.NamedArgs{
		"login":       user.Login,
		"email":       user.Email,
		"password":    user.Password,
		"date_joined": user.DateJoined,
	}
	err := pgInstance.db.QueryRow(ctx, query, args).Scan(&user.ID)
	if err != nil {
		return nil, fmt.Errorf("Error while creating user: %w", err)
	}
	return user, nil
}

func GetUserByEmail(ctx context.Context, email string, user *models.User) (*models.User, error) {
	query := `SELECT * FROM users WHERE email = '$email';`
	args := pgx.NamedArgs{
		"email": email,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	if err != nil {
		return nil, fmt.Errorf("No user with this email: %w", err)
	}
	return user, nil
}

func GetUserByUsername(ctx context.Context, username string, user *models.User) (*models.User, error) {
	query := `SELECT * FROM users WHERE login = '@login';`
	log.Print(username)
	args := pgx.NamedArgs{
		"login": username,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	log.Print(user)
	if err != nil {
		log.Print(err)
		return nil, fmt.Errorf("No user with this username: %w", err)
	}
	return user, nil
}

func GetUserById(ctx context.Context, id string, user *models.User) (*models.User, error) {
	query := `SELECT * FROM users WHERE id = @id;`
	args := pgx.NamedArgs{
		"id": id,
	}
	row := pgInstance.db.QueryRow(ctx, query, args)
	err := row.Scan(&user)
	if err != nil {
		return nil, fmt.Errorf("No user with this id: %w", err)
	}
	return user, nil
}
