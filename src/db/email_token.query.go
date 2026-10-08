package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type EmailTokenKind string

const (
	EmailTokenVerifyEmail   EmailTokenKind = "verify_email"
	EmailTokenPasswordReset EmailTokenKind = "reset_password"
	EmailTokenLoginCode     EmailTokenKind = "login_code"
)

func CreateEmailToken(ctx context.Context, userID int, kind EmailTokenKind, tokenHash string, ttlSeconds int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin create email token: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM email_tokens WHERE user_id = @user_id AND kind = @kind AND used_at IS NULL`,
		pgx.NamedArgs{"user_id": userID, "kind": kind},
	); err != nil {
		return fmt.Errorf("clear email tokens: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO email_tokens (user_id, kind, token_hash, expires_at)
		VALUES (@user_id, @kind, @token_hash, now() + make_interval(secs => @seconds))`,
		pgx.NamedArgs{
			"user_id":    userID,
			"kind":       kind,
			"token_hash": tokenHash,
			"seconds":    ttlSeconds,
		},
	); err != nil {
		return fmt.Errorf("insert email token: %w", err)
	}

	return tx.Commit(ctx)
}

func ConsumeEmailToken(ctx context.Context, kind EmailTokenKind, tokenHash string) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var userID int
	err = conn.QueryRow(ctx, `
		UPDATE email_tokens SET used_at = now()
		WHERE kind = @kind AND token_hash = @token_hash
		  AND used_at IS NULL AND expires_at > now()
		RETURNING user_id`,
		pgx.NamedArgs{"kind": kind, "token_hash": tokenHash},
	).Scan(&userID)

	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("consume email token: %w", err)
	}
	return userID, nil
}

func RegisterFailedLoginCode(ctx context.Context, userID, maxAttempts int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx, `
		UPDATE email_tokens
		SET attempts = attempts + 1,
		    used_at = CASE WHEN attempts + 1 >= @max THEN now() ELSE used_at END
		WHERE user_id = @user_id AND kind = @kind AND used_at IS NULL`,
		pgx.NamedArgs{
			"user_id": userID,
			"kind":    EmailTokenLoginCode,
			"max":     maxAttempts,
		},
	)
	if err != nil {
		return fmt.Errorf("register failed login code: %w", err)
	}
	return nil
}

func DeleteExpiredEmailTokens(ctx context.Context) (int64, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM email_tokens WHERE expires_at < now() - interval '7 days'`)
	if err != nil {
		return 0, fmt.Errorf("delete expired email tokens: %w", err)
	}
	return tag.RowsAffected(), nil
}
