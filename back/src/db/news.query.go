package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const newsColumns = `n.id, n.title, n.body, n.is_published, n.is_pinned, coalesce(a.login, '') AS author_login,
	to_char(n.published_at, 'YYYY-MM-DD HH24:MI') AS published_at,
	coalesce(to_char(n.updated_at, 'YYYY-MM-DD HH24:MI'), '') AS updated_at`

const newsFrom = `FROM news n LEFT JOIN users a ON a.id = n.author_id`

func scanNews(row pgx.Row) (*models.News, error) {
	var item models.News
	err := row.Scan(&item.ID, &item.Title, &item.Body, &item.IsPublished, &item.IsPinned,
		&item.AuthorLogin, &item.PublishedAt, &item.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan news: %w", err)
	}
	return &item, nil
}

func CreateNews(ctx context.Context, title, body string, isPublished, isPinned bool, authorID int) (*models.News, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var author any
	if authorID > 0 {
		author = authorID
	}

	query := `
		WITH inserted AS (
			INSERT INTO news (title, body, is_published, is_pinned, author_id)
			VALUES (@title, @body, @is_published, @is_pinned, @author_id)
			RETURNING *
		)
		SELECT ` + newsColumns + ` FROM inserted n LEFT JOIN users a ON a.id = n.author_id`

	item, err := scanNews(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"title":        title,
		"body":         body,
		"is_published": isPublished,
		"is_pinned":    isPinned,
		"author_id":    author,
	}))
	if err != nil {
		return nil, fmt.Errorf("create news: %w", err)
	}
	return item, nil
}

func UpdateNews(ctx context.Context, id int, title, body string, isPublished, isPinned bool) (*models.News, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `
		WITH updated AS (
			UPDATE news SET title = @title, body = @body, is_published = @is_published,
			                is_pinned = @is_pinned, updated_at = now()
			WHERE id = @id
			RETURNING *
		)
		SELECT ` + newsColumns + ` FROM updated n LEFT JOIN users a ON a.id = n.author_id`

	item, err := scanNews(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"id":           id,
		"title":        title,
		"body":         body,
		"is_published": isPublished,
		"is_pinned":    isPinned,
	}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update news: %w", err)
	}
	return item, nil
}

func DeleteNews(ctx context.Context, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM news WHERE id = @id`, pgx.NamedArgs{"id": id})
	if err != nil {
		return fmt.Errorf("delete news: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func GetNews(ctx context.Context, id int) (*models.News, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	item, err := scanNews(conn.QueryRow(ctx,
		`SELECT `+newsColumns+` `+newsFrom+` WHERE n.id = @id`, pgx.NamedArgs{"id": id}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get news: %w", err)
	}
	return item, nil
}

func ListNews(ctx context.Context, publishedOnly bool, limit, offset int) ([]*models.News, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 50 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	query := `SELECT ` + newsColumns + ` ` + newsFrom + `
		WHERE (NOT @published_only OR n.is_published)
		ORDER BY n.is_pinned DESC, n.published_at DESC
		LIMIT @limit OFFSET @offset`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{
		"published_only": publishedOnly,
		"limit":          limit,
		"offset":         offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list news: %w", err)
	}
	defer rows.Close()

	items := make([]*models.News, 0, limit)
	for rows.Next() {
		item, err := scanNews(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list news: %w", err)
	}
	return items, nil
}
