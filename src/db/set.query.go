package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

// setColumns — явный список колонок с приведением дат к тексту 'YYYY-MM-DD'
// и защитой от NULL в description.
const setColumns = `id, user_id, title, coalesce(description, '') AS description,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

func scanSet(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(&set.ID, &set.UserID, &set.Title, &set.Description, &set.DateCreated, &set.LastActivity)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan set: %w", err)
	}
	return &set, nil
}

// CreateSet создаёт сет и возвращает его вместе с датами, проставленными базой
// (date_created/last_activity имеют DEFAULT CURRENT_DATE).
func CreateSet(ctx context.Context, set *models.Set) (*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `INSERT INTO sets (title, description, user_id) VALUES
	(@title, @description, @user_id)
	RETURNING ` + setColumns

	created, err := scanSet(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"title":       set.Title,
		"description": set.Description,
		"user_id":     set.UserID,
	}))
	if err != nil {
		return nil, fmt.Errorf("create set: %w", err)
	}
	return created, nil
}

// GetSetsByUser возвращает сеты пользователя, свежие — первыми.
func GetSetsByUser(ctx context.Context, userID int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setColumns + `
	FROM sets
	WHERE user_id = @user_id
	ORDER BY last_activity DESC, id DESC`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list sets: %w", err)
	}
	defer rows.Close()

	sets := make([]*models.Set, 0)
	for rows.Next() {
		set, err := scanSet(rows)
		if err != nil {
			return nil, err
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list sets: %w", err)
	}
	return sets, nil
}

// GetSetByID возвращает сет пользователя. Чужие сеты считаются ненайденными,
// чтобы не подтверждать их существование.
func GetSetByID(ctx context.Context, id, userID int) (*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setColumns + ` FROM sets WHERE id = @id AND user_id = @user_id`

	set, err := scanSet(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": id, "user_id": userID}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get set by id: %w", err)
	}
	return set, nil
}
