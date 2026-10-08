package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

type PendingRegistration struct {
	ID       int
	Login    string
	Email    string
	Password string
}

const pendingColumns = `id, login, email, password`

func scanPendingRegistration(row pgx.Row) (*PendingRegistration, error) {
	var pending PendingRegistration
	err := row.Scan(&pending.ID, &pending.Login, &pending.Email, &pending.Password)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan pending registration: %w", err)
	}
	return &pending, nil
}

func CreatePendingRegistration(ctx context.Context, login, email, password, tokenHash string, ttlSeconds int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO pending_registrations (login, email, password, token_hash, expires_at)
		VALUES (@login, @email, @password, @token_hash, now() + make_interval(secs => @seconds))`,
		pgx.NamedArgs{
			"login":      login,
			"email":      email,
			"password":   password,
			"token_hash": tokenHash,
			"seconds":    ttlSeconds,
		},
	)
	if err != nil {
		return fmt.Errorf("create pending registration: %w", err)
	}
	return nil
}

func CreatePendingRegistrationWithInvite(ctx context.Context, login, email, password, tokenHash string, ttlSeconds, inviteID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin invite registration: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO pending_registrations (login, email, password, token_hash, invite_id, expires_at)
		VALUES (@login, @email, @password, @token_hash, @invite_id, now() + make_interval(secs => @seconds))`,
		pgx.NamedArgs{
			"login":      login,
			"email":      email,
			"password":   password,
			"token_hash": tokenHash,
			"invite_id":  inviteID,
			"seconds":    ttlSeconds,
		},
	); err != nil {
		return fmt.Errorf("create pending registration: %w", err)
	}

	tag, err := tx.Exec(ctx, `
		UPDATE invites SET used_at = now()
		WHERE id = @id AND used_at IS NULL AND expires_at > now()`,
		pgx.NamedArgs{"id": inviteID},
	)
	if err != nil {
		return fmt.Errorf("consume invite: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit invite registration: %w", err)
	}
	return nil
}

func CancelPendingRegistration(ctx context.Context, login string, inviteID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin cancel registration: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM pending_registrations WHERE lower(login) = lower(@login)`,
		pgx.NamedArgs{"login": login},
	); err != nil {
		return fmt.Errorf("delete pending registration: %w", err)
	}

	if inviteID > 0 {
		if _, err := tx.Exec(ctx,
			`UPDATE invites SET used_at = NULL, used_by = NULL WHERE id = @invite_id AND used_by IS NULL`,
			pgx.NamedArgs{"invite_id": inviteID},
		); err != nil {
			return fmt.Errorf("release invite: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func GetPendingRegistrationByLogin(ctx context.Context, login string) (*PendingRegistration, error) {
	query := `SELECT ` + pendingColumns + ` FROM pending_registrations WHERE lower(login) = lower(@login) AND expires_at > now()`

	return getSinglePendingRegistration(ctx, "get pending registration by login", query, pgx.NamedArgs{"login": login})
}

func GetPendingRegistrationByEmail(ctx context.Context, email string) (*PendingRegistration, error) {
	query := `SELECT ` + pendingColumns + ` FROM pending_registrations WHERE lower(email) = lower(@email) AND expires_at > now()`

	return getSinglePendingRegistration(ctx, "get pending registration by email", query, pgx.NamedArgs{"email": email})
}

func GetPendingRegistrationByToken(ctx context.Context, tokenHash string) (*PendingRegistration, error) {
	query := `SELECT ` + pendingColumns + ` FROM pending_registrations WHERE token_hash = @token_hash AND expires_at > now()`

	return getSinglePendingRegistration(ctx, "get pending registration by token", query, pgx.NamedArgs{"token_hash": tokenHash})
}

func RefreshPendingRegistrationToken(ctx context.Context, id int, tokenHash string, ttlSeconds int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE pending_registrations
		SET token_hash = @token_hash, expires_at = now() + make_interval(secs => @seconds)
		WHERE id = @id`,
		pgx.NamedArgs{"id": id, "token_hash": tokenHash, "seconds": ttlSeconds},
	)
	if err != nil {
		return fmt.Errorf("refresh pending registration token: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func CompletePendingRegistration(ctx context.Context, id int) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin complete registration: %w", err)
	}
	defer tx.Rollback(ctx)

	var (
		login, email, password string
		inviteID               *int
	)
	err = tx.QueryRow(ctx, `
		DELETE FROM pending_registrations
		WHERE id = @id AND expires_at > now()
		RETURNING login, email, password, invite_id`,
		pgx.NamedArgs{"id": id},
	).Scan(&login, &email, &password, &inviteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("claim pending registration: %w", err)
	}

	created, err := scanUser(tx.QueryRow(ctx, `
		INSERT INTO users (login, email, password, email_verified)
		VALUES (@login, @email, @password, true)
		RETURNING `+userColumns,
		pgx.NamedArgs{"login": login, "email": email, "password": password},
	))
	if err != nil {
		return nil, fmt.Errorf("create user from pending registration: %w", err)
	}

	if inviteID != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE invites SET used_by = @user_id WHERE id = @invite_id`,
			pgx.NamedArgs{"user_id": created.ID, "invite_id": *inviteID},
		); err != nil {
			return nil, fmt.Errorf("mark invite used by: %w", err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE users SET invited_by = (SELECT created_by FROM invites WHERE id = @invite_id) WHERE id = @user_id`,
			pgx.NamedArgs{"user_id": created.ID, "invite_id": *inviteID},
		); err != nil {
			return nil, fmt.Errorf("set invited by: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit complete registration: %w", err)
	}
	return created, nil
}

func DeleteExpiredPendingRegistrations(ctx context.Context) (int64, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM pending_registrations WHERE expires_at < now()`)
	if err != nil {
		return 0, fmt.Errorf("delete expired pending registrations: %w", err)
	}
	return tag.RowsAffected(), nil
}

func getSinglePendingRegistration(ctx context.Context, operation, query string, args pgx.NamedArgs) (*PendingRegistration, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	pending, err := scanPendingRegistration(conn.QueryRow(ctx, query, args))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("%s: %w", operation, err)
	}
	return pending, nil
}
