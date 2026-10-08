package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type Invite struct {
	ID        int    `json:"id"`
	Note      string `json:"note"`
	Used      bool   `json:"used"`
	UsedAt    string `json:"used_at"`
	ExpiresAt string `json:"expires_at"`
	CreatedAt string `json:"created_at"`
}

const inviteColumns = `id, note, used_at IS NOT NULL AS used, coalesce(to_char(used_at, 'YYYY-MM-DD HH24:MI'), '') AS used_at, to_char(expires_at, 'YYYY-MM-DD HH24:MI') AS expires_at, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at`

func scanInvite(row pgx.Row) (*Invite, error) {
	var invite Invite
	err := row.Scan(&invite.ID, &invite.Note, &invite.Used, &invite.UsedAt, &invite.ExpiresAt, &invite.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan invite: %w", err)
	}
	return &invite, nil
}

func CreateInvite(ctx context.Context, tokenHash, note string, createdBy int, ttlSeconds int) (*Invite, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var author any
	if createdBy > 0 {
		author = createdBy
	}

	query := `
		INSERT INTO invites (token_hash, note, created_by, expires_at)
		VALUES (@token_hash, @note, @created_by, now() + make_interval(secs => @seconds))
		RETURNING ` + inviteColumns

	invite, err := scanInvite(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"token_hash": tokenHash,
		"note":       note,
		"created_by": author,
		"seconds":    ttlSeconds,
	}))
	if err != nil {
		return nil, fmt.Errorf("create invite: %w", err)
	}
	return invite, nil
}

func GetActiveInviteByToken(ctx context.Context, tokenHash string) (*Invite, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + inviteColumns + `
		FROM invites
		WHERE token_hash = @token_hash AND used_at IS NULL AND expires_at > now()`

	invite, err := scanInvite(conn.QueryRow(ctx, query, pgx.NamedArgs{"token_hash": tokenHash}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get invite by token: %w", err)
	}
	return invite, nil
}

func DeleteInvite(ctx context.Context, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM invites WHERE id = @id AND used_at IS NULL`,
		pgx.NamedArgs{"id": id})
	if err != nil {
		return fmt.Errorf("delete invite: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func ListInvites(ctx context.Context, limit int) ([]*Invite, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := `SELECT ` + inviteColumns + ` FROM invites ORDER BY created_at DESC LIMIT @limit`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"limit": limit})
	if err != nil {
		return nil, fmt.Errorf("list invites: %w", err)
	}
	defer rows.Close()

	invites := make([]*Invite, 0, limit)
	for rows.Next() {
		invite, err := scanInvite(rows)
		if err != nil {
			return nil, err
		}
		invites = append(invites, invite)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list invites: %w", err)
	}
	return invites, nil
}

func DeleteExpiredInvites(ctx context.Context) (int64, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM invites WHERE expires_at < now() - interval '30 days'`)
	if err != nil {
		return 0, fmt.Errorf("delete expired invites: %w", err)
	}
	return tag.RowsAffected(), nil
}
