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

// Код PostgreSQL «нарушение уникальности»: по нему понимаем, что ключ темы занят у автора.
const pgUniqueViolation = "23505"

// Имя уникального индекса на user_themes: ключ уникален в пределах одного автора.
const themeKeyConstraint = "user_themes_key_uq"

// Сколько раз пробуем подобрать свободный ключ, если название повторяется.
const themeKeyAttempts = 12

const themeLibraryColumns = `t.id, t.theme_key, t.title, t.description, t.mode, t.base_theme, t.roles,
	to_char(t.created_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS created_at,
	to_char(t.updated_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS updated_at`

const themeLibraryFrom = ` FROM user_themes t`

func scanThemeLibraryItem(row pgx.Row) (*models.ThemeLibraryItem, error) {
	var (
		item  models.ThemeLibraryItem
		roles []byte
	)

	err := row.Scan(
		&item.ID,
		&item.Key,
		&item.Title,
		&item.Description,
		&item.Mode,
		&item.Base,
		&roles,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan theme: %w", err)
	}

	item.Roles = map[string]string{}
	if len(roles) > 0 {
		if err := json.Unmarshal(roles, &item.Roles); err != nil {
			return nil, fmt.Errorf("parse theme roles: %w", err)
		}
	}

	return &item, nil
}

// ListUserThemes — библиотека автора: новые темы сверху.
func ListUserThemes(ctx context.Context, userID int) ([]*models.ThemeLibraryItem, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+themeLibraryColumns+themeLibraryFrom+`
		WHERE t.author_id = @author_id
		ORDER BY t.updated_at DESC, t.id DESC`, pgx.NamedArgs{"author_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list user themes: %w", err)
	}
	defer rows.Close()

	items := make([]*models.ThemeLibraryItem, 0)
	for rows.Next() {
		item, err := scanThemeLibraryItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read user themes: %w", err)
	}

	return items, nil
}

// CountUserThemes нужен для лимита: в библиотеке помещается ThemeLibraryLimit тем.
func CountUserThemes(ctx context.Context, userID int) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var total int
	err = conn.QueryRow(ctx, `SELECT count(*) FROM user_themes WHERE author_id = @author_id`,
		pgx.NamedArgs{"author_id": userID}).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("count user themes: %w", err)
	}

	return total, nil
}

func GetUserTheme(ctx context.Context, userID, id int) (*models.ThemeLibraryItem, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `SELECT `+themeLibraryColumns+themeLibraryFrom+`
		WHERE t.id = @id AND t.author_id = @author_id`,
		pgx.NamedArgs{"id": id, "author_id": userID})

	return scanThemeLibraryItem(row)
}

// CreateUserTheme сохраняет тему в библиотеку. Ключ собирается из названия; если у автора
// уже есть тема с таким ключом, берём следующий свободный — придумывать ключ не нужно.
func CreateUserTheme(ctx context.Context, userID int, payload models.ThemePayload) (*models.ThemeLibraryItem, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	encoded, err := json.Marshal(payload.Roles)
	if err != nil {
		return nil, fmt.Errorf("encode theme roles: %w", err)
	}

	base := models.ThemeKeyFromTitle(payload.Title)

	for attempt := 0; attempt < themeKeyAttempts; attempt++ {
		var id int

		err = conn.QueryRow(ctx, `
			INSERT INTO user_themes (author_id, theme_key, title, description, mode, base_theme, roles)
			VALUES (@author_id, @theme_key, @title, @description, @mode, @base_theme, @roles::jsonb)
			RETURNING id`, pgx.NamedArgs{
			"author_id":   userID,
			"theme_key":   models.ThemeKeyCandidate(base, attempt),
			"title":       payload.Title,
			"description": payload.Description,
			"mode":        payload.Mode,
			"base_theme":  payload.Base,
			"roles":       string(encoded),
		}).Scan(&id)
		if err == nil {
			return GetUserTheme(ctx, userID, id)
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == themeKeyConstraint {
			continue
		}

		return nil, fmt.Errorf("create user theme: %w", err)
	}

	return nil, fmt.Errorf("create user theme: не удалось подобрать ключ для %q", payload.Title)
}

// UpdateUserTheme меняет тему на месте. Ключ остаётся прежним: по нему тема записана в
// применённом оформлении браузера, поэтому переименование его не трогает.
func UpdateUserTheme(ctx context.Context, userID, id int, payload models.ThemePayload) (*models.ThemeLibraryItem, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	encoded, err := json.Marshal(payload.Roles)
	if err != nil {
		return nil, fmt.Errorf("encode theme roles: %w", err)
	}

	tag, err := conn.Exec(ctx, `
		UPDATE user_themes
		SET title = @title,
		    description = @description,
		    mode = @mode,
		    base_theme = @base_theme,
		    roles = @roles::jsonb,
		    updated_at = now()
		WHERE id = @id AND author_id = @author_id`, pgx.NamedArgs{
		"id":          id,
		"author_id":   userID,
		"title":       payload.Title,
		"description": payload.Description,
		"mode":        payload.Mode,
		"base_theme":  payload.Base,
		"roles":       string(encoded),
	})
	if err != nil {
		return nil, fmt.Errorf("update user theme: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetUserTheme(ctx, userID, id)
}

func DeleteUserTheme(ctx context.Context, userID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM user_themes WHERE id = @id AND author_id = @author_id`,
		pgx.NamedArgs{"id": id, "author_id": userID})
	if err != nil {
		return fmt.Errorf("delete user theme: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}
