package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/links"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const setColumns = `id, user_id, title, title_key, slug, visibility,
	coalesce(description, '') AS description,
	coalesce(content, '') AS content,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

const setSummaryColumns = `id, user_id, title, slug, visibility,
	coalesce(description, '') AS description,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

func scanSet(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.TitleKey,
		&set.Slug,
		&set.Visibility,
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
		&set.Slug,
		&set.Visibility,
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
	query := `INSERT INTO sets (title, title_key, slug, visibility, description, content, user_id) VALUES
	(@title, @title_key, @slug, @visibility, @description, @content, @user_id)
	RETURNING ` + setColumns

	created, err := scanSet(tx.QueryRow(ctx, query, pgx.NamedArgs{
		"title":       set.Title,
		"title_key":   set.TitleKey,
		"slug":        set.Slug,
		"visibility":  string(set.Visibility),
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
	  slug = @slug,
	  visibility = @visibility,
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
		"slug":        set.Slug,
		"visibility":  string(set.Visibility),
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

func GetPublicSetBySlug(ctx context.Context, slug string) (*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setColumns + `
	FROM sets
	WHERE slug = @slug AND visibility IN ('public', 'unlisted')`

	set, err := scanSet(conn.QueryRow(ctx, query, pgx.NamedArgs{"slug": slug}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get public set by slug: %w", err)
	}
	return set, nil
}

func GetPublicSets(ctx context.Context, limit, offset int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setSummaryColumns + `
	FROM sets
	WHERE visibility = 'public'
	ORDER BY last_activity DESC, id DESC
	LIMIT @limit OFFSET @offset`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"limit": limit, "offset": offset})
	if err != nil {
		return nil, fmt.Errorf("list public sets: %w", err)
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
		return nil, fmt.Errorf("list public sets: %w", err)
	}
	return sets, nil
}

func ReserveSlug(ctx context.Context, tx pgx.Tx, title string, exceptID int) (string, error) {
	base := links.Slugify(title)
	if base == "" {
		base = "set"
	}

	candidate := base
	for attempt := 2; attempt <= 50; attempt++ {
		var taken bool
		err := tx.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM sets WHERE slug = @slug AND id <> @except_id)`,
			pgx.NamedArgs{"slug": candidate, "except_id": exceptID},
		).Scan(&taken)
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !taken {
			return candidate, nil
		}

		candidate = fmt.Sprintf("%s-%d", base, attempt)
	}

	return "", fmt.Errorf("не удалось подобрать свободный адрес для %q", title)
}
