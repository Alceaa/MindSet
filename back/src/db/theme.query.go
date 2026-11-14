package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Код PostgreSQL «нарушение уникальности»: по нему понимаем, что ключ темы занят.
const pgUniqueViolation = "23505"

const themePackageColumns = `t.id, t.theme_key, t.title, t.description, t.mode, t.base_theme, t.variables,
	t.status, t.moderation_note,
	to_char(t.created_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS created_at,
	to_char(t.updated_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS updated_at,
	coalesce(to_char(t.published_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `), '') AS published_at,
	coalesce(u.login, '') AS author`

const themePackageFrom = ` FROM theme_packages t LEFT JOIN users u ON u.id = t.author_id`

func scanThemePackage(row pgx.Row) (*models.ThemePackage, error) {
	var (
		item      models.ThemePackage
		variables []byte
	)

	err := row.Scan(
		&item.ID,
		&item.Key,
		&item.Title,
		&item.Description,
		&item.Mode,
		&item.Base,
		&variables,
		&item.Status,
		&item.Note,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.PublishedAt,
		&item.Author,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan theme package: %w", err)
	}

	item.Variables = map[string]string{}
	if len(variables) > 0 {
		if err := json.Unmarshal(variables, &item.Variables); err != nil {
			return nil, fmt.Errorf("parse theme variables: %w", err)
		}
	}

	return &item, nil
}

func GetThemePackageByID(ctx context.Context, id int) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `SELECT `+themePackageColumns+themePackageFrom+` WHERE t.id = @id`,
		pgx.NamedArgs{"id": id})

	return scanThemePackage(row)
}

func GetOwnThemePackage(ctx context.Context, authorID, id int) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `SELECT `+themePackageColumns+themePackageFrom+`
		WHERE t.id = @id AND t.author_id = @author_id`,
		pgx.NamedArgs{"id": id, "author_id": authorID})

	return scanThemePackage(row)
}

func ListOwnThemePackages(ctx context.Context, authorID int) ([]*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+themePackageColumns+themePackageFrom+`
		WHERE t.author_id = @author_id
		ORDER BY t.updated_at DESC, t.id DESC`, pgx.NamedArgs{"author_id": authorID})
	if err != nil {
		return nil, fmt.Errorf("list own themes: %w", err)
	}
	defer rows.Close()

	return collectThemePackages(rows)
}

func CountOwnThemePackages(ctx context.Context, authorID int) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var total int
	err = conn.QueryRow(ctx, `SELECT count(*) FROM theme_packages WHERE author_id = @author_id`,
		pgx.NamedArgs{"author_id": authorID}).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("count own themes: %w", err)
	}

	return total, nil
}

func CreateThemePackage(ctx context.Context, authorID int, payload models.ThemePayload) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	encoded, err := json.Marshal(payload.Variables)
	if err != nil {
		return nil, fmt.Errorf("encode theme variables: %w", err)
	}

	// Ключ собирается из названия и может быть занят другой темой: тогда берём следующий
	// свободный — автору не нужно придумывать ключ, а конфликт не превращается в ошибку.
	for attempt := 0; attempt < themeKeyAttempts; attempt++ {
		var id int
		err = conn.QueryRow(ctx, `
			INSERT INTO theme_packages (author_id, theme_key, title, description, mode, base_theme, variables, status)
			VALUES (@author_id, @theme_key, @title, @description, @mode, @base_theme, @variables::jsonb, @status)
			RETURNING id`, pgx.NamedArgs{
			"author_id":   authorID,
			"theme_key":   models.ThemeKeyCandidate(payload.Key, attempt),
			"title":       payload.Title,
			"description": payload.Description,
			"mode":        payload.Mode,
			"base_theme":  payload.Base,
			"variables":   string(encoded),
			"status":      models.ThemeStatusDraft,
		}).Scan(&id)

		if err == nil {
			return GetThemePackageByID(ctx, id)
		}
		if !isThemeKeyConflict(err) {
			return nil, fmt.Errorf("create theme package: %w", err)
		}
	}

	return nil, fmt.Errorf("create theme package: не удалось подобрать свободный ключ")
}

// Сколько раз пробуем ключ из названия, прежде чем сдаться: base, base-2, base-3…
const themeKeyAttempts = 50

func isThemeKeyConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == models.ThemeKeyConstraint
}

func UpdateThemePackage(ctx context.Context, authorID, id int, payload models.ThemePayload) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	encoded, err := json.Marshal(payload.Variables)
	if err != nil {
		return nil, fmt.Errorf("encode theme variables: %w", err)
	}

	tag, err := conn.Exec(ctx, `
		UPDATE theme_packages
		SET title = @title, description = @description, mode = @mode,
		    base_theme = @base_theme, variables = @variables::jsonb, status = @status,
		    moderation_note = '', updated_at = now()
		WHERE id = @id AND author_id = @author_id`, pgx.NamedArgs{
		"id":          id,
		"author_id":   authorID,
		"title":       payload.Title,
		"description": payload.Description,
		"mode":        payload.Mode,
		"base_theme":  payload.Base,
		"variables":   string(encoded),
		"status":      models.ThemeStatusDraft,
	})
	if err != nil {
		return nil, fmt.Errorf("update theme package: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetThemePackageByID(ctx, id)
}

func SubmitThemePackage(ctx context.Context, authorID, id int) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE theme_packages
		SET status = @status, moderation_note = '', updated_at = now()
		WHERE id = @id AND author_id = @author_id`, pgx.NamedArgs{
		"id":        id,
		"author_id": authorID,
		"status":    models.ThemeStatusPending,
	})
	if err != nil {
		return nil, fmt.Errorf("submit theme package: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetThemePackageByID(ctx, id)
}

func DeleteThemePackage(ctx context.Context, authorID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM theme_packages WHERE id = @id AND author_id = @author_id`,
		pgx.NamedArgs{"id": id, "author_id": authorID})
	if err != nil {
		return fmt.Errorf("delete theme package: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

func ListThemePackagesByStatus(ctx context.Context, status string, limit int) ([]*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	rows, err := conn.Query(ctx, `SELECT `+themePackageColumns+themePackageFrom+`
		WHERE (@status = '' OR t.status = @status)
		ORDER BY t.updated_at DESC, t.id DESC
		LIMIT @limit`, pgx.NamedArgs{"status": status, "limit": limit})
	if err != nil {
		return nil, fmt.Errorf("list theme packages: %w", err)
	}
	defer rows.Close()

	return collectThemePackages(rows)
}

func ListPublishedThemes(ctx context.Context) ([]*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+themePackageColumns+themePackageFrom+`
		WHERE t.status = @status
		ORDER BY t.published_at DESC NULLS LAST, t.id DESC`, pgx.NamedArgs{"status": models.ThemeStatusApproved})
	if err != nil {
		return nil, fmt.Errorf("list published themes: %w", err)
	}
	defer rows.Close()

	return collectThemePackages(rows)
}

func ModerateThemePackage(ctx context.Context, id int, status, note string) (*models.ThemePackage, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE theme_packages
		SET status = @status,
		    moderation_note = @note,
		    published_at = CASE WHEN @publish::boolean THEN coalesce(published_at, now()) ELSE NULL END,
		    updated_at = now()
		WHERE id = @id`, pgx.NamedArgs{
		"id":      id,
		"status":  status,
		"note":    note,
		"publish": status == models.ThemeStatusApproved,
	})
	if err != nil {
		return nil, fmt.Errorf("moderate theme package: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetThemePackageByID(ctx, id)
}

func collectThemePackages(rows pgx.Rows) ([]*models.ThemePackage, error) {
	items := make([]*models.ThemePackage, 0)

	for rows.Next() {
		item, err := scanThemePackage(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read theme packages: %w", err)
	}

	return items, nil
}
