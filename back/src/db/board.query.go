package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// В списке сцену не тянем: доска может весить мегабайты, а списку нужны только подписи.
const boardListColumns = `b.id, b.title, b.visibility,
	to_char(b.date_created, 'YYYY-MM-DD') AS created_at,
	to_char(b.updated_at AT TIME ZONE 'UTC', ` + isoUTCTimeFormat + `) AS updated_at`

const boardColumns = boardListColumns + `, b.doc`

func scanBoardListItem(row pgx.Row) (*models.BoardListItem, error) {
	var board models.BoardListItem

	err := row.Scan(&board.ID, &board.Title, &board.Visibility, &board.CreatedAt, &board.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan board: %w", err)
	}

	return &board, nil
}

func scanBoard(row pgx.Row) (*models.Board, error) {
	var board models.Board
	var doc []byte

	err := row.Scan(
		&board.ID,
		&board.Title,
		&board.Visibility,
		&board.CreatedAt,
		&board.UpdatedAt,
		&doc,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan board: %w", err)
	}

	board.Doc = json.RawMessage(doc)

	return &board, nil
}

// ListBoards — свои доски: последние изменённые сверху.
func ListBoards(ctx context.Context, userID int) ([]*models.BoardListItem, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+boardListColumns+`
		FROM boards b
		WHERE b.user_id = @user_id
		ORDER BY b.updated_at DESC, b.id DESC`, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list boards: %w", err)
	}
	defer rows.Close()

	boards := make([]*models.BoardListItem, 0)
	for rows.Next() {
		board, err := scanBoardListItem(rows)
		if err != nil {
			return nil, err
		}
		boards = append(boards, board)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list boards: %w", err)
	}

	return boards, nil
}

// GetBoard — своя доска вместе со сценой.
func GetBoard(ctx context.Context, userID, id int) (*models.Board, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `SELECT `+boardColumns+`
		FROM boards b
		WHERE b.id = @id AND b.user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID})

	return scanBoard(row)
}

// CreateBoard — новая доска. Сцену можно передать сразу или пустой {}.
func CreateBoard(ctx context.Context, userID int, title, titleKey, visibility string, doc []byte) (*models.Board, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	if len(doc) == 0 {
		doc = []byte("{}")
	}

	var id int
	if err := conn.QueryRow(ctx, `
		INSERT INTO boards (user_id, title, title_key, visibility, doc)
		VALUES (@user_id, @title, @title_key, @visibility, @doc)
		RETURNING id`, pgx.NamedArgs{
		"user_id":    userID,
		"title":      title,
		"title_key":  titleKey,
		"visibility": visibility,
		"doc":        doc,
	}).Scan(&id); err != nil {
		return nil, fmt.Errorf("create board: %w", err)
	}

	return GetBoard(ctx, userID, id)
}

// UpdateBoard — переименование и видимость. Сцену не трогаем: её сохраняет автосохранение.
func UpdateBoard(ctx context.Context, userID, id int, title, titleKey, visibility string) (*models.Board, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE boards
		SET title = @title, title_key = @title_key, visibility = @visibility
		WHERE id = @id AND user_id = @user_id`, pgx.NamedArgs{
		"id":         id,
		"user_id":    userID,
		"title":      title,
		"title_key":  titleKey,
		"visibility": visibility,
	})
	if err != nil {
		return nil, fmt.Errorf("update board: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetBoard(ctx, userID, id)
}

// SaveBoardDoc — автосохранение сцены: приходит часто, меняет только doc и время правки.
func SaveBoardDoc(ctx context.Context, userID, id int, doc []byte) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE boards
		SET doc = @doc, updated_at = now()
		WHERE id = @id AND user_id = @user_id`, pgx.NamedArgs{
		"id":      id,
		"user_id": userID,
		"doc":     doc,
	})
	if err != nil {
		return fmt.Errorf("save board doc: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// DeleteBoard — доска уходит вместе со сценой.
func DeleteBoard(ctx context.Context, userID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`DELETE FROM boards WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID})
	if err != nil {
		return fmt.Errorf("delete board: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// ownsBoard проверяет, что доска принадлежит пользователю: чужую не отдаём.
func ownsBoard(ctx context.Context, conn *pgxpool.Pool, userID, boardID int) error {
	var owned bool

	err := conn.QueryRow(ctx,
		`SELECT true FROM boards WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": boardID, "user_id": userID}).Scan(&owned)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("owns board: %w", err)
	}

	return nil
}
