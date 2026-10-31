package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// ExportSet — сет целиком для выгрузки данных: метаданные плюс полный текст заметки.
// В JSON метаданных текст не дублируем — он лежит рядом отдельным .md файлом.
type ExportSet struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	Visibility   string `json:"visibility"`
	Description  string `json:"description"`
	DateCreated  string `json:"date_created"`
	LastActivity string `json:"last_activity"`
	Content      string `json:"-"`
}

// GetSetsForExport отдаёт все свои сеты вместе с полным текстом:
// обычные списки везут только превью (280 символов).
func GetSetsForExport(ctx context.Context, userID int) ([]*ExportSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `
		SELECT id, title, slug, visibility, coalesce(description, ''),
		       to_char(date_created, 'YYYY-MM-DD') AS date_created,
		       to_char(last_activity, 'YYYY-MM-DD') AS last_activity,
		       coalesce(content, '')
		FROM sets
		WHERE user_id = @user_id
		ORDER BY date_created, id`, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("export sets: %w", err)
	}
	defer rows.Close()

	sets := make([]*ExportSet, 0)
	for rows.Next() {
		var set ExportSet
		if err := rows.Scan(
			&set.ID,
			&set.Title,
			&set.Slug,
			&set.Visibility,
			&set.Description,
			&set.DateCreated,
			&set.LastActivity,
			&set.Content,
		); err != nil {
			return nil, fmt.Errorf("scan export set: %w", err)
		}
		sets = append(sets, &set)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("export sets: %w", err)
	}
	return sets, nil
}
