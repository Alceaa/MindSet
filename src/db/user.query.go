package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const userColumns = `id, login, email, password, coalesce(bio, '') AS bio, coalesce(to_char(date_joined, 'YYYY-MM-DD'), '') AS date_joined`

// scanUser читает одну строку users и переводит pgx.ErrNoRows в db.ErrNotFound.
func scanUser(row pgx.Row) (*models.User, error) {
	var user models.User
	err := row.Scan(&user.ID, &user.Login, &user.Email, &user.Password, &user.Bio, &user.DateJoined)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}
	return &user, nil
}

// CreateUser создаёт пользователя и возвращает его вместе с полями,
// проставленными базой (id, date_joined по умолчанию CURRENT_DATE).
func CreateUser(ctx context.Context, user *models.User) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}
	query := `INSERT INTO users (login, email, password) VALUES
	(@login, @email, @password)
	RETURNING ` + userColumns

	row := conn.QueryRow(ctx, query, pgx.NamedArgs{
		"login":    user.Login,
		"email":    user.Email,
		"password": user.Password,
	})

	created, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return created, nil
}

func GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE email = @email`

	return getSingleUser(ctx, "get user by email", query, pgx.NamedArgs{"email": email})
}

func GetUserByLogin(ctx context.Context, login string) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE login = @login`

	return getSingleUser(ctx, "get user by login", query, pgx.NamedArgs{"login": login})
}

func GetUserById(ctx context.Context, id int) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE id = @id`

	return getSingleUser(ctx, "get user by id", query, pgx.NamedArgs{"id": id})
}

// FindLoginOrEmailConflict проверяет занятость логина и почты одним запросом,
// чтобы вернуть пользователю понятную ошибку вместо текста нарушения UNIQUE.
func FindLoginOrEmailConflict(ctx context.Context, login, email string) (loginTaken bool, emailTaken bool, err error) {
	conn, err := pool()
	if err != nil {
		return false, false, err
	}

	query := `SELECT
	  EXISTS(SELECT 1 FROM users WHERE login = @login),
	  EXISTS(SELECT 1 FROM users WHERE email = @email)`

	err = conn.QueryRow(ctx, query, pgx.NamedArgs{"login": login, "email": email}).
		Scan(&loginTaken, &emailTaken)
	if err != nil {
		return false, false, fmt.Errorf("check login/email conflict: %w", err)
	}
	return loginTaken, emailTaken, nil
}

func getSingleUser(ctx context.Context, operation, query string, args pgx.NamedArgs) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	user, err := scanUser(conn.QueryRow(ctx, query, args))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("%s: %w", operation, err)
	}
	return user, nil
}
