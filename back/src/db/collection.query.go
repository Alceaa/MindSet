package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const collectionColumns = `c.id, c.title, c.color, c.position,
	(SELECT count(*) FROM set_collections sc WHERE sc.collection_id = c.id) AS sets_count,
	(SELECT count(*) FROM saved_set_collections ssc WHERE ssc.collection_id = c.id) AS saved_count`

func scanCollection(row pgx.Row) (*models.Collection, error) {
	var collection models.Collection

	err := row.Scan(
		&collection.ID,
		&collection.Title,
		&collection.Color,
		&collection.Position,
		&collection.SetsCount,
		&collection.SavedCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan collection: %w", err)
	}

	return &collection, nil
}

// ListCollections — свои коллекции по порядку, с числом сетов и снимков.
func ListCollections(ctx context.Context, userID int) ([]*models.Collection, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `SELECT `+collectionColumns+`
		FROM collections c
		WHERE c.user_id = @user_id
		ORDER BY c.position, c.id`, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}
	defer rows.Close()

	collections := make([]*models.Collection, 0)
	for rows.Next() {
		collection, err := scanCollection(rows)
		if err != nil {
			return nil, err
		}
		collections = append(collections, collection)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}

	return collections, nil
}

// GetCollection — одна своя коллекция с числом сетов.
func GetCollection(ctx context.Context, userID, id int) (*models.Collection, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	row := conn.QueryRow(ctx, `SELECT `+collectionColumns+`
		FROM collections c
		WHERE c.id = @id AND c.user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID})

	return scanCollection(row)
}

// CreateCollection — новая коллекция встаёт в конец списка.
func CreateCollection(ctx context.Context, userID int, title, titleKey, color string) (*models.Collection, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var id int
	if err := conn.QueryRow(ctx, `
		INSERT INTO collections (user_id, title, title_key, color, position)
		VALUES (@user_id, @title, @title_key, @color,
		        coalesce((SELECT max(position) FROM collections WHERE user_id = @user_id), 0) + 1)
		RETURNING id`, pgx.NamedArgs{
		"user_id":   userID,
		"title":     title,
		"title_key": titleKey,
		"color":     color,
	}).Scan(&id); err != nil {
		return nil, fmt.Errorf("create collection: %w", err)
	}

	return GetCollection(ctx, userID, id)
}

// UpdateCollection — переименование, цвет и место в списке.
func UpdateCollection(ctx context.Context, userID, id int, title, titleKey, color string, position int) (*models.Collection, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	tag, err := conn.Exec(ctx, `
		UPDATE collections
		SET title = @title, title_key = @title_key, color = @color, position = @position
		WHERE id = @id AND user_id = @user_id`, pgx.NamedArgs{
		"id":        id,
		"user_id":   userID,
		"title":     title,
		"title_key": titleKey,
		"color":     color,
		"position":  position,
	})
	if err != nil {
		return nil, fmt.Errorf("update collection: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return GetCollection(ctx, userID, id)
}

// DeleteCollection — сеты остаются, уходят только связи.
func DeleteCollection(ctx context.Context, userID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`DELETE FROM collections WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID})
	if err != nil {
		return fmt.Errorf("delete collection: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// AddSetCollection кладёт свой сет в свою коллекцию. Сет может лежать сразу в нескольких
// коллекциях, поэтому повторное добавление просто ничего не меняет.
func AddSetCollection(ctx context.Context, userID, setID, collectionID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	if err := ownsSet(ctx, conn, userID, setID); err != nil {
		return err
	}
	if err := ownsCollection(ctx, conn, userID, collectionID); err != nil {
		return err
	}

	if _, err := conn.Exec(ctx, `
		INSERT INTO set_collections (set_id, collection_id, position)
		VALUES (@set_id, @collection_id,
		        coalesce((SELECT max(position) FROM set_collections WHERE collection_id = @collection_id), 0) + 1)
		ON CONFLICT (set_id, collection_id) DO NOTHING`,
		pgx.NamedArgs{"set_id": setID, "collection_id": collectionID}); err != nil {
		return fmt.Errorf("add set collection: %w", err)
	}

	return nil
}

// RemoveSetCollection убирает сет из коллекции: сам сет остаётся, уходит только связь.
func RemoveSetCollection(ctx context.Context, userID, setID, collectionID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	if err := ownsSet(ctx, conn, userID, setID); err != nil {
		return err
	}

	if _, err := conn.Exec(ctx,
		`DELETE FROM set_collections WHERE set_id = @set_id AND collection_id = @collection_id`,
		pgx.NamedArgs{"set_id": setID, "collection_id": collectionID}); err != nil {
		return fmt.Errorf("remove set collection: %w", err)
	}

	return nil
}

// AddSavedSetCollection — то же для сохранённого сета: владелец снимка распоряжается им сам.
func AddSavedSetCollection(ctx context.Context, userID, savedSetID, collectionID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	if err := ownsSavedSet(ctx, conn, userID, savedSetID); err != nil {
		return err
	}
	if err := ownsCollection(ctx, conn, userID, collectionID); err != nil {
		return err
	}

	if _, err := conn.Exec(ctx, `
		INSERT INTO saved_set_collections (saved_set_id, collection_id, position)
		VALUES (@saved_set_id, @collection_id,
		        coalesce((SELECT max(position) FROM saved_set_collections WHERE collection_id = @collection_id), 0) + 1)
		ON CONFLICT (saved_set_id, collection_id) DO NOTHING`,
		pgx.NamedArgs{"saved_set_id": savedSetID, "collection_id": collectionID}); err != nil {
		return fmt.Errorf("add saved set collection: %w", err)
	}

	return nil
}

// RemoveSavedSetCollection убирает снимок из коллекции.
func RemoveSavedSetCollection(ctx context.Context, userID, savedSetID, collectionID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	if err := ownsSavedSet(ctx, conn, userID, savedSetID); err != nil {
		return err
	}

	if _, err := conn.Exec(ctx,
		`DELETE FROM saved_set_collections WHERE saved_set_id = @saved_set_id AND collection_id = @collection_id`,
		pgx.NamedArgs{"saved_set_id": savedSetID, "collection_id": collectionID}); err != nil {
		return fmt.Errorf("remove saved set collection: %w", err)
	}

	return nil
}

// ownsSavedSet проверяет, что снимок принадлежит пользователю.
func ownsSavedSet(ctx context.Context, conn *pgxpool.Pool, userID, savedSetID int) error {
	var owned bool
	err := conn.QueryRow(ctx,
		`SELECT true FROM saved_sets WHERE id = @id AND owner_user_id = @user_id`,
		pgx.NamedArgs{"id": savedSetID, "user_id": userID}).Scan(&owned)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("check saved set: %w", err)
	}
	return nil
}

// ownsSet проверяет, что сет принадлежит пользователю (иначе ErrNotFound).
func ownsSet(ctx context.Context, conn *pgxpool.Pool, userID, setID int) error {
	var owned bool
	err := conn.QueryRow(ctx, `SELECT true FROM sets WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": setID, "user_id": userID}).Scan(&owned)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("check set: %w", err)
	}
	return nil
}

// ownsCollection проверяет, что коллекция принадлежит пользователю.
func ownsCollection(ctx context.Context, conn *pgxpool.Pool, userID, collectionID int) error {
	var owned bool
	err := conn.QueryRow(ctx, `SELECT true FROM collections WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": collectionID, "user_id": userID}).Scan(&owned)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("check collection: %w", err)
	}
	return nil
}
