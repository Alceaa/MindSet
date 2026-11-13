package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const apiTokenColumns = `id, title, prefix,
	to_char(created_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS created_at,
	coalesce(to_char(last_used_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `), '') AS last_used_at,
	coalesce(to_char(expires_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `), '') AS expires_at,
	(expires_at IS NOT NULL AND expires_at <= now()) AS expired`

func scanAPIToken(row pgx.Row) (*models.APIToken, error) {
	var token models.APIToken

	err := row.Scan(
		&token.ID,
		&token.Title,
		&token.Prefix,
		&token.CreatedAt,
		&token.LastUsedAt,
		&token.ExpiresAt,
		&token.Expired,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan api token: %w", err)
	}

	return &token, nil
}

func ListAPITokens(ctx context.Context, userID int) ([]*models.APIToken, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+apiTokenColumns+`
		FROM api_tokens
		WHERE user_id = @user_id
		ORDER BY id DESC`, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list api tokens: %w", err)
	}
	defer rows.Close()

	tokens := make([]*models.APIToken, 0)
	for rows.Next() {
		token, err := scanAPIToken(rows)
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list api tokens: %w", err)
	}

	return tokens, nil
}

func CountAPITokens(ctx context.Context, userID int) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var total int
	err = conn.QueryRow(ctx, `SELECT count(*) FROM api_tokens WHERE user_id = @user_id`,
		pgx.NamedArgs{"user_id": userID}).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("count api tokens: %w", err)
	}

	return total, nil
}

func CreateAPIToken(ctx context.Context, userID int, title, prefix, tokenHash string, expiresInDays int) (*models.APIToken, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `
		INSERT INTO api_tokens (user_id, title, prefix, token_hash, expires_at)
		VALUES (@user_id, @title, @prefix, @token_hash,
		        CASE WHEN @days::int > 0 THEN now() + make_interval(days => @days::int) END)
		RETURNING `+apiTokenColumns, pgx.NamedArgs{
		"user_id":    userID,
		"title":      title,
		"prefix":     prefix,
		"token_hash": tokenHash,
		"days":       expiresInDays,
	})

	token, err := scanAPIToken(row)
	if err != nil {
		return nil, fmt.Errorf("create api token: %w", err)
	}

	return token, nil
}

func GetAPITokenByHash(ctx context.Context, tokenHash string) (*models.APIToken, int, error) {
	conn, err := pool()
	if err != nil {
		return nil, 0, err
	}

	row := conn.QueryRow(ctx, `SELECT `+apiTokenColumns+`, user_id
		FROM api_tokens
		WHERE token_hash = @token_hash`, pgx.NamedArgs{"token_hash": tokenHash})

	var token models.APIToken
	var userID int

	err = row.Scan(
		&token.ID,
		&token.Title,
		&token.Prefix,
		&token.CreatedAt,
		&token.LastUsedAt,
		&token.ExpiresAt,
		&token.Expired,
		&userID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, ErrNotFound
		}
		return nil, 0, fmt.Errorf("get api token: %w", err)
	}

	return &token, userID, nil
}

func TouchAPIToken(ctx context.Context, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx, `UPDATE api_tokens
		SET last_used_at = now()
		WHERE id = @id AND (last_used_at IS NULL OR last_used_at < now() - interval '1 hour')`,
		pgx.NamedArgs{"id": id})
	if err != nil {
		return fmt.Errorf("touch api token: %w", err)
	}

	return nil
}

func DeleteAPIToken(ctx context.Context, userID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM api_tokens WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID})
	if err != nil {
		return fmt.Errorf("delete api token: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}
