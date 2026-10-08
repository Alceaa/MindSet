package db

import (
	"context"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func RecordAdminAction(ctx context.Context, adminID int, adminLogin, action, targetType string, targetID int, details string) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	var author any
	if adminID > 0 {
		author = adminID
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO admin_actions (admin_id, admin_login, action, target_type, target_id, details)
		VALUES (@admin_id, @admin_login, @action, @target_type, @target_id, @details)`,
		pgx.NamedArgs{
			"admin_id":    author,
			"admin_login": adminLogin,
			"action":      action,
			"target_type": targetType,
			"target_id":   targetID,
			"details":     details,
		},
	)
	if err != nil {
		return fmt.Errorf("record admin action: %w", err)
	}
	return nil
}

func ListAdminActions(ctx context.Context, limit int) ([]*models.AdminAction, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := conn.Query(ctx, `
		SELECT id, coalesce(admin_login, ''), action, target_type, coalesce(target_id, 0),
		       coalesce(details, ''), to_char(created_at, 'YYYY-MM-DD HH24:MI')
		FROM admin_actions ORDER BY created_at DESC LIMIT @limit`,
		pgx.NamedArgs{"limit": limit})
	if err != nil {
		return nil, fmt.Errorf("list admin actions: %w", err)
	}
	defer rows.Close()

	actions := make([]*models.AdminAction, 0, limit)
	for rows.Next() {
		var action models.AdminAction
		if err := rows.Scan(
			&action.ID,
			&action.AdminLogin,
			&action.Action,
			&action.TargetType,
			&action.TargetID,
			&action.Details,
			&action.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan admin action: %w", err)
		}
		actions = append(actions, &action)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list admin actions: %w", err)
	}
	return actions, nil
}

func CreateBugReport(ctx context.Context, userID int, login, page, topic, message string) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	var author any
	if userID > 0 {
		author = userID
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO bug_reports (user_id, login, page, topic, message)
		VALUES (@user_id, @login, @page, @topic, @message)`,
		pgx.NamedArgs{
			"user_id": author,
			"login":   login,
			"page":    page,
			"topic":   topic,
			"message": message,
		},
	)
	if err != nil {
		return fmt.Errorf("create bug report: %w", err)
	}
	return nil
}

func ListBugReports(ctx context.Context, status string, limit int) ([]*models.BugReport, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := conn.Query(ctx, `
		SELECT id, coalesce(login, ''), coalesce(page, ''), topic, message, status,
		       to_char(created_at, 'YYYY-MM-DD HH24:MI')
		FROM bug_reports
		WHERE (@status = '' OR status = @status)
		ORDER BY created_at DESC LIMIT @limit`,
		pgx.NamedArgs{"status": status, "limit": limit})
	if err != nil {
		return nil, fmt.Errorf("list bug reports: %w", err)
	}
	defer rows.Close()

	reports := make([]*models.BugReport, 0, limit)
	for rows.Next() {
		var report models.BugReport
		if err := rows.Scan(
			&report.ID,
			&report.Login,
			&report.Page,
			&report.Topic,
			&report.Message,
			&report.Status,
			&report.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan bug report: %w", err)
		}
		reports = append(reports, &report)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list bug reports: %w", err)
	}
	return reports, nil
}

func SetBugReportStatus(ctx context.Context, id int, status string) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `UPDATE bug_reports SET status = @status WHERE id = @id`,
		pgx.NamedArgs{"id": id, "status": status})
	if err != nil {
		return fmt.Errorf("set bug report status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
