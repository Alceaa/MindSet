package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const adminUserQuery = `SELECT
	u.id,
	u.login,
	u.email,
	u.role,
	u.email_verified,
	u.two_factor_email,
	(u.blocked_at IS NOT NULL) AS blocked,
	coalesce(to_char(u.blocked_at, 'YYYY-MM-DD HH24:MI'), '') AS blocked_at,
	coalesce(u.blocked_reason, '') AS blocked_reason,
	coalesce(to_char(u.date_joined, 'YYYY-MM-DD'), '') AS date_joined,
	(SELECT count(*) FROM sets s WHERE s.user_id = u.id) AS set_count,
	coalesce((SELECT to_char(MAX(s.last_activity), 'YYYY-MM-DD') FROM sets s WHERE s.user_id = u.id), '') AS last_activity
FROM users u
WHERE (@q = '' OR u.login ILIKE '%' || @q || '%' OR u.email ILIKE '%' || @q || '%')
  AND (NOT @blocked_only OR u.blocked_at IS NOT NULL)
ORDER BY u.id DESC
LIMIT @limit OFFSET @offset`

func ListAdminUsers(ctx context.Context, query string, blockedOnly bool, limit, offset int) ([]*models.AdminUser, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := conn.Query(ctx, adminUserQuery, pgx.NamedArgs{
		"q":            query,
		"blocked_only": blockedOnly,
		"limit":        limit,
		"offset":       offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list admin users: %w", err)
	}
	defer rows.Close()

	users := make([]*models.AdminUser, 0, limit)
	for rows.Next() {
		var user models.AdminUser
		if err := rows.Scan(
			&user.ID,
			&user.Login,
			&user.Email,
			&user.Role,
			&user.EmailVerified,
			&user.TwoFactorEmail,
			&user.Blocked,
			&user.BlockedAt,
			&user.BlockedReason,
			&user.DateJoined,
			&user.SetCount,
			&user.LastActivity,
		); err != nil {
			return nil, fmt.Errorf("scan admin user: %w", err)
		}
		users = append(users, &user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list admin users: %w", err)
	}
	return users, nil
}

func SetUserBlocked(ctx context.Context, userID int, blocked bool, reason string, adminID int) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var author any
	if adminID > 0 {
		author = adminID
	}

	query := `
		UPDATE users SET
			blocked_at = CASE WHEN @blocked::boolean THEN now() ELSE NULL END,
			blocked_reason = CASE WHEN @blocked::boolean THEN @reason::text ELSE '' END,
			blocked_by = CASE WHEN @blocked::boolean THEN @admin_id::int ELSE NULL END,
			token_epoch = token_epoch + CASE WHEN @blocked::boolean THEN 1 ELSE 0 END
		WHERE id = @id
		RETURNING ` + userColumns

	updated, err := scanUser(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"id":       userID,
		"blocked":  blocked,
		"reason":   reason,
		"admin_id": author,
	}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set user blocked: %w", err)
	}
	return updated, nil
}

func SetUserRole(ctx context.Context, userID int, role string) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `UPDATE users SET role = @role WHERE id = @id RETURNING ` + userColumns
	updated, err := scanUser(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": userID, "role": role}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set user role: %w", err)
	}
	return updated, nil
}

func CountAdmins(ctx context.Context) (int, error) {
	conn, err := pool()
	if err != nil {
		return 0, err
	}

	var count int
	if err := conn.QueryRow(ctx,
		`SELECT count(*) FROM users WHERE role = @role AND blocked_at IS NULL`,
		pgx.NamedArgs{"role": models.RoleAdmin},
	).Scan(&count); err != nil {
		return 0, fmt.Errorf("count admins: %w", err)
	}
	return count, nil
}
