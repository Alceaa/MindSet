package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

// GetUserTheme отдаёт тему оформления пользователя: nil, если она не задана.
func GetUserTheme(ctx context.Context, userID int) (*models.UserTheme, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var raw string
	err = conn.QueryRow(ctx,
		`SELECT coalesce(custom_theme::text, '') FROM users WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get user theme: %w", err)
	}

	if raw == "" || raw == "null" {
		return nil, nil
	}

	var theme models.UserTheme
	if err := json.Unmarshal([]byte(raw), &theme); err != nil {
		return nil, fmt.Errorf("decode user theme: %w", err)
	}

	return &theme, nil
}

// UpdateUserTheme сохраняет тему оформления в профиле: она переезжает между устройствами.
func UpdateUserTheme(ctx context.Context, userID int, theme models.UserTheme) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	encoded, err := json.Marshal(theme)
	if err != nil {
		return fmt.Errorf("encode user theme: %w", err)
	}

	tag, err := conn.Exec(ctx,
		`UPDATE users SET custom_theme = @theme::jsonb WHERE id = @id`,
		pgx.NamedArgs{"id": userID, "theme": string(encoded)},
	)
	if err != nil {
		return fmt.Errorf("update user theme: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// ClearUserTheme возвращает пользователя к базовому оформлению.
func ClearUserTheme(ctx context.Context, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	if _, err := conn.Exec(ctx,
		`UPDATE users SET custom_theme = NULL WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	); err != nil {
		return fmt.Errorf("clear user theme: %w", err)
	}

	return nil
}
