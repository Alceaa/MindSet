package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const savedSetInsertColumns = `id,
	coalesce(owner_user_id, 0) AS owner_user_id,
	coalesce(set_id, 0) AS set_id,
	coalesce(source_user_id, 0) AS source_user_id,
	source_login,
	source_slug,
	title,
	description,
	content,
	frozen,
	frozen_auto,
	coalesce(to_char(revoked_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS revoked_at,
	to_char(date_saved, 'YYYY-MM-DD') AS date_saved,
	to_char(last_update, 'YYYY-MM-DD') AS last_update`

const savedSetColumns = `ss.id,
	coalesce(ss.owner_user_id, 0) AS owner_user_id,
	coalesce(ss.set_id, 0) AS set_id,
	coalesce(ss.source_user_id, 0) AS source_user_id,
	ss.source_login,
	ss.source_slug,
	ss.title,
	ss.description,
	ss.content,
	ss.frozen,
	ss.frozen_auto,
	ss.tombstone_id,
	coalesce(to_char(ss.revoked_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS revoked_at,
	to_char(ss.date_saved, 'YYYY-MM-DD') AS date_saved,
	to_char(ss.last_update, 'YYYY-MM-DD') AS last_update`

const savedSetJoin = `FROM saved_sets ss
LEFT JOIN sets live ON live.id = ss.set_id`

func scanSavedSet(row pgx.Row) (*models.SavedSet, error) {
	var saved models.SavedSet
	err := row.Scan(
		&saved.ID,
		&saved.OwnerUserID,
		&saved.SetID,
		&saved.SourceUserID,
		&saved.SourceLogin,
		&saved.SourceSlug,
		&saved.Title,
		&saved.Description,
		&saved.Content,
		&saved.Frozen,
		&saved.FrozenAuto,

		&saved.RevokedAt,
		&saved.DateSaved,
		&saved.LastUpdate,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan saved set: %w", err)
	}
	return &saved, nil
}

func SaveSet(ctx context.Context, ownerID int, set *models.Set, authorLogin string, refresh bool) (*models.SavedSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `INSERT INTO saved_sets
		(owner_user_id, set_id, source_user_id, source_login, source_slug,
		 title, description, content, last_update)
		VALUES (@owner_id, @set_id, @set_id_user, @login, @slug,
			@title, @description, @content, CURRENT_DATE)
		ON CONFLICT (owner_user_id, set_id) DO UPDATE SET
		  title = EXCLUDED.title,
		  description = EXCLUDED.description,
		  content = CASE
		    WHEN saved_sets.frozen AND NOT @refresh THEN saved_sets.content
		    ELSE EXCLUDED.content
		  END,
		  source_login = EXCLUDED.source_login,
		  source_slug = EXCLUDED.source_slug,
		  last_update = CASE
		    WHEN saved_sets.frozen AND NOT @refresh THEN saved_sets.last_update
		    ELSE CURRENT_DATE
		  END
		RETURNING ` + savedSetInsertColumns

	return scanSavedSet(conn.QueryRow(ctx, query, pgx.NamedArgs{
		"owner_id":    ownerID,
		"set_id":      set.ID,
		"set_id_user": set.UserID,
		"login":       authorLogin,
		"slug":        set.Slug,
		"title":       set.Title,
		"description": set.Description,
		"content":     set.Content,
		"refresh":     refresh,
	}))
}

func DeleteSavedSet(ctx context.Context, ownerID, id int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(
		ctx,
		`DELETE FROM saved_sets WHERE id = @id AND owner_user_id = @owner_id`,
		pgx.NamedArgs{"id": id, "owner_id": ownerID},
	)
	if err != nil {
		return fmt.Errorf("delete saved set: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func SetFrozen(ctx context.Context, ownerID, id int, frozen bool) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(
		ctx,
		`UPDATE saved_sets
		 SET frozen = @frozen,
		     frozen_auto = false,
		     last_update = CASE WHEN @frozen THEN last_update ELSE CURRENT_DATE END
		 WHERE id = @id AND owner_user_id = @owner_id`,
		pgx.NamedArgs{"frozen": frozen, "id": id, "owner_id": ownerID},
	)
	if err != nil {
		return fmt.Errorf("set frozen: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func GetSavedSets(ctx context.Context, ownerID int) ([]*models.SavedSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + savedSetColumns + `,
		coalesce(live.title, '') AS live_title,
		coalesce(live.slug, '') AS live_slug,
		coalesce(to_char(live.last_activity, 'YYYY-MM-DD'), '') AS live_last_activity
	` + savedSetJoin + `
	WHERE ss.owner_user_id = @owner_id
	ORDER BY ss.last_update DESC, ss.id DESC`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"owner_id": ownerID})
	if err != nil {
		return nil, fmt.Errorf("list saved sets: %w", err)
	}
	defer rows.Close()

	result := make([]*models.SavedSet, 0)
	for rows.Next() {
		var saved models.SavedSet
		if err := rows.Scan(
			&saved.ID,
			&saved.OwnerUserID,
			&saved.SetID,
			&saved.SourceUserID,
			&saved.SourceLogin,
			&saved.SourceSlug,
			&saved.Title,
			&saved.Description,
			&saved.Content,
			&saved.Frozen,
			&saved.FrozenAuto,
			&saved.TombstoneID,
			&saved.RevokedAt,
			&saved.DateSaved,
			&saved.LastUpdate,
			&saved.LiveTitle,
			&saved.LiveSlug,
			&saved.LiveActivity,
		); err != nil {
			return nil, fmt.Errorf("scan saved set: %w", err)
		}
		result = append(result, &saved)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list saved sets: %w", err)
	}

	return result, nil
}

func GetSavedSet(ctx context.Context, ownerID, id int) (*models.SavedSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + savedSetColumns + `,
		coalesce(live.title, '') AS live_title,
		coalesce(live.slug, '') AS live_slug,
		coalesce(to_char(live.last_activity, 'YYYY-MM-DD'), '') AS live_last_activity
	` + savedSetJoin + `
	WHERE ss.owner_user_id = @owner_id AND ss.id = @id`

	var saved models.SavedSet
	if err := conn.QueryRow(ctx, query, pgx.NamedArgs{
		"owner_id": ownerID,
		"id":       id,
	}).Scan(
		&saved.ID,
		&saved.OwnerUserID,
		&saved.SetID,
		&saved.SourceUserID,
		&saved.SourceLogin,
		&saved.SourceSlug,
		&saved.Title,
		&saved.Description,
		&saved.Content,
		&saved.Frozen,
		&saved.FrozenAuto,
		&saved.TombstoneID,
		&saved.RevokedAt,
		&saved.DateSaved,
		&saved.LastUpdate,
		&saved.LiveTitle,
		&saved.LiveSlug,
		&saved.LiveActivity,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get saved set: %w", err)
	}

	return &saved, nil
}

func SnapshotStateOf(saved *models.SavedSet, liveVisibility models.Visibility) models.SnapshotState {
	if saved.SetID == 0 {
		if saved.RevokedAt != "" {
			return models.SnapshotStateSuppressed
		}
		return models.SnapshotStateSourceGone
	}

	if !liveVisibility.ReadableByOthers() {
		if saved.RevokedAt != "" {
			return models.SnapshotStateSuppressed
		}
		return models.SnapshotStateHidden
	}

	if saved.Frozen {
		if saved.LiveActivity != "" && saved.LiveActivity > saved.LastUpdate {
			return models.SnapshotStateAttention
		}
		return models.SnapshotStateFrozen
	}

	return models.SnapshotStateLive
}

func applySnapshotVisibility(saved *models.SavedSet) {
	switch saved.State {
	case models.SnapshotStateHidden, models.SnapshotStateSuppressed:
		saved.Content = ""
		saved.Description = ""
	}
}

func AnnotateSavedSets(ctx context.Context, ownerID int, saved []*models.SavedSet) error {
	if len(saved) == 0 {
		return nil
	}

	conn, err := pool()
	if err != nil {
		return err
	}

	for _, item := range saved {
		if item.SetID == 0 {
			if item.RevokedAt != "" {
				item.State = models.SnapshotStateSuppressed
			} else {
				item.State = models.SnapshotStateSourceGone
			}
			applySnapshotVisibility(item)
			continue
		}

		var visibility models.Visibility
		err := conn.QueryRow(ctx,
			`SELECT visibility FROM sets WHERE id = @id`,
			pgx.NamedArgs{"id": item.SetID},
		).Scan(&visibility)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				if item.RevokedAt != "" {
					item.State = models.SnapshotStateSuppressed
				} else {
					item.State = models.SnapshotStateSourceGone
				}
				applySnapshotVisibility(item)
				continue
			}
			return fmt.Errorf("load source visibility: %w", err)
		}

		item.State = SnapshotStateOf(item, visibility)
		applySnapshotVisibility(item)
	}

	return nil
}

func GetPublicSnapshot(ctx context.Context, id int) (*models.SavedSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + savedSetColumns + `,
		coalesce(live.title, '') AS live_title,
		coalesce(live.slug, '') AS live_slug,
		coalesce(to_char(live.last_activity, 'YYYY-MM-DD'), '') AS live_last_activity,
		coalesce(live.visibility, '') AS live_visibility
	` + savedSetJoin + `
	WHERE ss.id = @id
	  AND ss.revoked_at IS NULL
	  AND (
	    live.visibility IN ('public', 'unlisted')
	    OR (
	      ss.set_id IS NULL
	      AND EXISTS (
	        SELECT 1
	        FROM set_links l
	        JOIN sets p ON p.id = l.from_set_id
	        WHERE p.user_id = ss.owner_user_id
	          AND p.visibility IN ('public', 'unlisted')
	          AND (
	               (l.to_set_id IS NOT NULL AND l.to_set_id = ss.set_id)
	            OR (l.target_login <> ''
	                AND lower(l.target_login) = lower(ss.source_login)
	                AND l.target_slug = ss.source_slug)
	          )
	      )
	    )
	  )
	LIMIT 1`

	var saved models.SavedSet
	var liveVisibility string
	if err := conn.QueryRow(ctx, query, pgx.NamedArgs{"id": id}).Scan(
		&saved.ID,
		&saved.OwnerUserID,
		&saved.SetID,
		&saved.SourceUserID,
		&saved.SourceLogin,
		&saved.SourceSlug,
		&saved.Title,
		&saved.Description,
		&saved.Content,
		&saved.Frozen,
		&saved.FrozenAuto,
		&saved.TombstoneID,
		&saved.RevokedAt,
		&saved.DateSaved,
		&saved.LastUpdate,
		&saved.LiveTitle,
		&saved.LiveSlug,
		&saved.LiveActivity,
		&liveVisibility,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get public snapshot: %w", err)
	}

	saved.SnapshotID = saved.ID
	saved.State = SnapshotStateOf(&saved, models.Visibility(liveVisibility))
	applySnapshotVisibility(&saved)
	return &saved, nil
}

func GetSavedSetBySource(ctx context.Context, ownerID int, login, slug string) (*models.SavedSet, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + savedSetColumns + `,
		coalesce(live.title, '') AS live_title,
		coalesce(live.slug, '') AS live_slug,
		coalesce(to_char(live.last_activity, 'YYYY-MM-DD'), '') AS live_last_activity
	` + savedSetJoin + `
	WHERE ss.owner_user_id = @owner_id
	  AND lower(ss.source_login) = lower(@login)
	  AND ss.source_slug = @slug
	LIMIT 1`

	var saved models.SavedSet
	err = conn.QueryRow(ctx, query, pgx.NamedArgs{
		"owner_id": ownerID,
		"login":    login,
		"slug":     slug,
	}).Scan(
		&saved.ID,
		&saved.OwnerUserID,
		&saved.SetID,
		&saved.SourceUserID,
		&saved.SourceLogin,
		&saved.SourceSlug,
		&saved.Title,
		&saved.Description,
		&saved.Content,
		&saved.Frozen,
		&saved.FrozenAuto,
		&saved.TombstoneID,

		&saved.RevokedAt,
		&saved.DateSaved,
		&saved.LastUpdate,
		&saved.LiveTitle,
		&saved.LiveSlug,
		&saved.LiveActivity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get saved set by source: %w", err)
	}

	return &saved, nil
}
