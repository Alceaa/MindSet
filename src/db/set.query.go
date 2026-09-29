package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const setColumns = `id, user_id, title, coalesce(description, '') AS description,
	coalesce(content, '') AS content,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

const setSummaryColumns = `id, user_id, title, coalesce(description, '') AS description,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

func scanSet(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.Description,
		&set.Content,
		&set.DateCreated,
		&set.LastActivity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan set: %w", err)
	}
	return &set, nil
}

func scanSetSummary(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.Description,
		&set.DateCreated,
		&set.LastActivity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan set summary: %w", err)
	}
	return &set, nil
}

func CreateSet(ctx context.Context, tx pgx.Tx, set *models.Set) (*models.Set, error) {
	query := `INSERT INTO sets (title, title_key, description, content, user_id) VALUES
	(@title, @title_key, @description, @content, @user_id)
	RETURNING ` + setColumns

	created, err := scanSet(tx.QueryRow(ctx, query, pgx.NamedArgs{
		"title":       set.Title,
		"title_key":   set.TitleKey,
		"description": set.Description,
		"content":     set.Content,
		"user_id":     set.UserID,
	}))
	if err != nil {
		return nil, fmt.Errorf("create set: %w", err)
	}
	return created, nil
}

func UpdateSet(ctx context.Context, tx pgx.Tx, set *models.Set) (*models.Set, error) {
	query := `UPDATE sets SET
	  title = @title,
	  title_key = @title_key,
	  description = @description,
	  content = @content,
	  last_activity = CURRENT_DATE
	WHERE id = @id AND user_id = @user_id
	RETURNING ` + setColumns

	updated, err := scanSet(tx.QueryRow(ctx, query, pgx.NamedArgs{
		"id":          set.ID,
		"user_id":     set.UserID,
		"title":       set.Title,
		"title_key":   set.TitleKey,
		"description": set.Description,
		"content":     set.Content,
	}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update set: %w", err)
	}
	return updated, nil
}

func DeleteSet(ctx context.Context, id, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(
		ctx,
		`DELETE FROM sets WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("delete set: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func GetSetsByUser(ctx context.Context, userID int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setSummaryColumns + `
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
		set, err := scanSetSummary(rows)
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
