package db

import (
	"context"
	"fmt"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func CreateSet(ctx context.Context, set *models.Set) (*models.Set, error) {
	query := `INSERT INTO sets (title, description, date_created,  last_activity) VALUES 
	(@title, @description, @date_created, @last_activity) RETURNING *`
	args := pgx.NamedArgs{
		"title":         set.Title,
		"description":   set.Description,
		"date_created":  set.DateCreated,
		"last_activity": set.LastActivity,
	}
	err := pgInstance.db.QueryRow(ctx, query, args).Scan(&set.ID)
	if err != nil {
		return nil, fmt.Errorf("Error while creating set: %w", err)
	}
	return set, nil
}
