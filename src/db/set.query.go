package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"mindset/links"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const setColumns = `id, user_id, title, title_key, slug, visibility, forbid_copies,
	coalesce(description, '') AS description,
	coalesce(content, '') AS content,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

const setSummaryColumns = `id, user_id, title, slug, visibility, forbid_copies,
	coalesce(description, '') AS description,
	to_char(date_created, 'YYYY-MM-DD') AS date_created,
	to_char(last_activity, 'YYYY-MM-DD') AS last_activity`

func scanSet(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.TitleKey,
		&set.Slug,
		&set.Visibility,
		&set.ForbidCopies,
		&set.Description,
		&set.Content,
		&set.DateCreated,
		&set.LastActivity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan set: %w", err)
	}
	return &set, nil
}

func scanSetSummary(row pgx.Row) (*models.Set, error) {
	var set models.Set
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.Slug,
		&set.Visibility,
		&set.ForbidCopies,
		&set.Description,
		&set.DateCreated,
		&set.LastActivity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan set summary: %w", err)
	}
	return &set, nil
}

func CreateSet(ctx context.Context, tx pgx.Tx, set *models.Set) (*models.Set, error) {
	query := `INSERT INTO sets (title, title_key, slug, visibility, forbid_copies, description, content, user_id) VALUES
	(@title, @title_key, @slug, @visibility, @forbid_copies, @description, @content, @user_id)
	RETURNING ` + setColumns

	created, err := scanSet(tx.QueryRow(ctx, query, pgx.NamedArgs{
		"title":         set.Title,
		"title_key":     set.TitleKey,
		"slug":          set.Slug,
		"visibility":    string(set.Visibility),
		"forbid_copies": set.ForbidCopies,
		"description":   set.Description,
		"content":       set.Content,
		"user_id":       set.UserID,
	}))
	if err != nil {
		return nil, fmt.Errorf("create set: %w", err)
	}
	return created, nil
}

func UpdateSet(ctx context.Context, tx pgx.Tx, set *models.Set) (*models.Set, error) {
	query := `UPDATE sets SET
	  title = @title,
	  title_key = @title_key,
	  slug = @slug,
	  visibility = @visibility,
	  forbid_copies = @forbid_copies,
	  description = @description,
	  content = @content,
	  last_activity = CURRENT_DATE
	WHERE id = @id AND user_id = @user_id
	RETURNING ` + setColumns

	updated, err := scanSet(tx.QueryRow(ctx, query, pgx.NamedArgs{
		"id":            set.ID,
		"user_id":       set.UserID,
		"title":         set.Title,
		"title_key":     set.TitleKey,
		"slug":          set.Slug,
		"visibility":    string(set.Visibility),
		"forbid_copies": set.ForbidCopies,
		"description":   set.Description,
		"content":       set.Content,
	}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update set: %w", err)
	}
	return updated, nil
}

func LockSetForDelete(ctx context.Context, tx pgx.Tx, id, userID int) (*models.Set, error) {
	set, err := scanSet(tx.QueryRow(ctx,
		`SELECT `+setColumns+` FROM sets WHERE id = @id AND user_id = @user_id FOR UPDATE`,
		pgx.NamedArgs{"id": id, "user_id": userID},
	))
	if err != nil {
		return nil, err
	}
	return set, nil
}

func DeleteSetInTx(ctx context.Context, tx pgx.Tx, id, userID int) error {
	tag, err := tx.Exec(
		ctx,
		`DELETE FROM sets WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": id, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("delete set: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func TombstoneSet(ctx context.Context, tx pgx.Tx, set *models.Set, authorLogin string, forbidCopies bool) error {
	purge := forbidCopies || !set.Visibility.ReadableByOthers()

	if purge {
		if _, err := tx.Exec(
			ctx,
			`UPDATE saved_sets
			 SET content = '', description = '',
			     frozen = true, frozen_auto = true,
			     revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
			 WHERE set_id = @set_id`,
			pgx.NamedArgs{"set_id": set.ID},
		); err != nil {
			return fmt.Errorf("purge saved set bodies: %w", err)
		}
	} else if _, err := tx.Exec(
		ctx,
		`UPDATE saved_sets
		 SET frozen = true, frozen_auto = true
		 WHERE set_id = @set_id`,
		pgx.NamedArgs{"set_id": set.ID},
	); err != nil {
		return fmt.Errorf("freeze saved sets on delete: %w", err)
	}

	_, err := tx.Exec(
		ctx,
		`INSERT INTO author_tombstones (login) VALUES (@login)
		 ON CONFLICT DO NOTHING`,
		pgx.NamedArgs{"login": authorLogin},
	)
	if err != nil {
		return fmt.Errorf("insert author tombstone: %w", err)
	}
	return nil
}

func GetSetsByUser(ctx context.Context, userID int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setSummaryColumns + `
	FROM sets
	WHERE user_id = @user_id
	ORDER BY last_activity DESC, id DESC`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list sets: %w", err)
	}
	defer rows.Close()

	sets := make([]*models.Set, 0)
	for rows.Next() {
		set, err := scanSetSummary(rows)
		if err != nil {
			return nil, err
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list sets: %w", err)
	}
	return sets, nil
}

func GetSetByID(ctx context.Context, id, userID int) (*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setColumns + ` FROM sets WHERE id = @id AND user_id = @user_id`

	set, err := scanSet(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": id, "user_id": userID}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get set by id: %w", err)
	}
	return set, nil
}

func GetPublicSetBySlugWithAuthor(ctx context.Context, slug string) (*models.Set, string, error) {
	conn, err := pool()
	if err != nil {
		return nil, "", err
	}

	set, err := scanSet(conn.QueryRow(ctx,
		`SELECT `+setColumns+`
		 FROM sets
		 WHERE slug = @slug AND visibility IN ('public', 'unlisted')`,
		pgx.NamedArgs{"slug": slug},
	))
	if err != nil {
		return nil, "", err
	}

	author, err := GetUserById(ctx, set.UserID)
	if err != nil {
		return nil, "", err
	}

	return set, author.Login, nil
}

func GetSetByIDForSnapshot(ctx context.Context, id int) (*models.Set, string, error) {
	conn, err := pool()
	if err != nil {
		return nil, "", err
	}

	set, err := scanSet(conn.QueryRow(ctx,
		`SELECT `+setColumns+` FROM sets WHERE id = @id`,
		pgx.NamedArgs{"id": id},
	))
	if err != nil {
		return nil, "", err
	}

	author, err := GetUserById(ctx, set.UserID)
	if err != nil {
		return nil, "", err
	}

	return set, author.Login, nil
}

func GetPublicSetBySlug(ctx context.Context, slug string) (*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT ` + setColumns + `
	FROM sets
	WHERE slug = @slug AND visibility IN ('public', 'unlisted')`

	set, err := scanSet(conn.QueryRow(ctx, query, pgx.NamedArgs{"slug": slug}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get public set by slug: %w", err)
	}
	return set, nil
}

const publicSetColumns = `s.id, s.user_id, s.title, s.slug, s.visibility, s.forbid_copies,
	coalesce(s.description, '') AS description,
	to_char(s.date_created, 'YYYY-MM-DD') AS date_created,
	to_char(s.last_activity, 'YYYY-MM-DD') AS last_activity,
	u.login AS author_login`

const publicSetsFilter = `s.visibility = 'public'
	  AND (@search = '' OR s.title ILIKE '%' || @search || '%' OR coalesce(s.description, '') ILIKE '%' || @search || '%')`

func scanPublicSet(row pgx.Row) (*models.Set, error) {
	var (
		set   models.Set
		login string
	)
	err := row.Scan(
		&set.ID,
		&set.UserID,
		&set.Title,
		&set.Slug,
		&set.Visibility,
		&set.ForbidCopies,
		&set.Description,
		&set.DateCreated,
		&set.LastActivity,
		&login,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan public set: %w", err)
	}

	set.Author = &models.SetAuthor{Login: login}
	return &set, nil
}

func GetPublicSets(ctx context.Context, search string, limit, offset int) ([]*models.Set, int, error) {
	conn, err := pool()
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT ` + publicSetColumns + `
	FROM sets s
	JOIN users u ON u.id = s.user_id
	WHERE ` + publicSetsFilter + `
	ORDER BY s.last_activity DESC, s.id DESC
	LIMIT @limit OFFSET @offset`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{
		"search": search,
		"limit":  limit,
		"offset": offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list public sets: %w", err)
	}
	defer rows.Close()

	sets := make([]*models.Set, 0)
	for rows.Next() {
		set, err := scanPublicSet(rows)
		if err != nil {
			return nil, 0, err
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("list public sets: %w", err)
	}

	countQuery := `SELECT count(*) FROM sets s WHERE ` + publicSetsFilter

	var total int
	if err := conn.QueryRow(ctx, countQuery, pgx.NamedArgs{"search": search}).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count public sets: %w", err)
	}

	return sets, total, nil
}

func ReserveSlug(ctx context.Context, tx pgx.Tx, title string, exceptID int) (string, error) {
	base := links.Slugify(title)
	if base == "" {
		base = "set"
	}

	candidate := base
	for attempt := 2; attempt <= 50; attempt++ {
		var taken bool
		err := tx.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM sets WHERE slug = @slug AND id <> @except_id)`,
			pgx.NamedArgs{"slug": candidate, "except_id": exceptID},
		).Scan(&taken)
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !taken {
			return candidate, nil
		}

		candidate = fmt.Sprintf("%s-%d", base, attempt)
	}

	return "", fmt.Errorf("не удалось подобрать свободный адрес для %q", title)
}

func SetTombstone(ctx context.Context, tx pgx.Tx, setID, ownerID int, deadline time.Time, forbidApplied bool) (int, error) {
	var tombstoneID int
	err := tx.QueryRow(ctx,
		`INSERT INTO set_tombstones (set_id, owner_user_id, deadline, forbid_applied)
		 VALUES (@set_id, @owner_user_id, @deadline, @forbid_applied)
		 RETURNING id`,
		pgx.NamedArgs{
			"set_id":         setID,
			"owner_user_id":  ownerID,
			"deadline":       deadline.Format("2006-01-02"),
			"forbid_applied": forbidApplied,
		},
	).Scan(&tombstoneID)
	if err != nil {
		return 0, fmt.Errorf("insert tombstone: %w", err)
	}
	return tombstoneID, nil
}

func GetSetCopyStats(ctx context.Context, setID int) (int, int, error) {
	conn, err := pool()
	if err != nil {
		return 0, 0, err
	}

	var copyCount, accountCount int
	err = conn.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(DISTINCT owner_user_id)
		 FROM saved_sets
		 WHERE set_id = @set_id`,
		pgx.NamedArgs{"set_id": setID},
	).Scan(&copyCount, &accountCount)
	if err != nil {
		return 0, 0, fmt.Errorf("count set copy stats: %w", err)
	}
	return copyCount, accountCount, nil
}

func FreezeSavedSets(ctx context.Context, tx pgx.Tx, setID int) error {
	_, err := tx.Exec(
		ctx,
		`UPDATE saved_sets
		 SET frozen = true, frozen_auto = true
		 WHERE set_id = @set_id`,
		pgx.NamedArgs{"set_id": setID},
	)
	if err != nil {
		return fmt.Errorf("freeze saved sets on delete: %w", err)
	}
	return nil
}

func LinkSavedSetsToTombstone(ctx context.Context, tx pgx.Tx, setID, tombstoneID int) error {
	_, err := tx.Exec(ctx,
		`UPDATE saved_sets SET tombstone_id = @tombstone_id WHERE set_id = @set_id`,
		pgx.NamedArgs{
			"set_id":       setID,
			"tombstone_id": tombstoneID,
		},
	)
	if err != nil {
		return fmt.Errorf("link saved sets to tombstone: %w", err)
	}
	return nil
}

type Tombstone struct {
	ID            int    `json:"id"`
	SetID         int    `json:"set_id"`
	Title         string `json:"title"`
	Deadline      string `json:"deadline"`
	ForbidApplied bool   `json:"forbid_applied"`
	OwnerID       int    `json:"owner_id"`
}

func GetSetTombstones(ctx context.Context, ownerID int) ([]*Tombstone, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx,
		`SELECT st.id, st.set_id, to_char(st.deadline, 'YYYY-MM-DD') AS deadline,
		        st.forbid_applied, coalesce(st.owner_user_id, 0) AS owner_id,
		        coalesce((SELECT ss.title FROM saved_sets ss
		                   WHERE ss.tombstone_id = st.id
		                   ORDER BY ss.id LIMIT 1), '') AS title
		 FROM set_tombstones st
		 WHERE st.owner_user_id = @owner_id
		 ORDER BY st.deadline ASC`,
		pgx.NamedArgs{"owner_id": ownerID},
	)
	if err != nil {
		return nil, fmt.Errorf("list tombstones: %w", err)
	}
	defer rows.Close()

	tombstones := make([]*Tombstone, 0)
	for rows.Next() {
		var tombstone Tombstone
		if err := rows.Scan(&tombstone.ID, &tombstone.SetID, &tombstone.Deadline, &tombstone.ForbidApplied, &tombstone.OwnerID, &tombstone.Title); err != nil {
			return nil, fmt.Errorf("scan tombstone: %w", err)
		}
		tombstones = append(tombstones, &tombstone)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tombstones: %w", err)
	}
	return tombstones, nil
}

func ForbidSetTombstone(ctx context.Context, tx pgx.Tx, tombstoneID, ownerID int) error {
	tag, err := tx.Exec(ctx,
		`UPDATE set_tombstones SET forbid_applied = true
		  WHERE id = @id AND owner_user_id = @owner_id`,
		pgx.NamedArgs{"id": tombstoneID, "owner_id": ownerID},
	)
	if err != nil {
		return fmt.Errorf("mark tombstone forbid applied: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	if _, err := tx.Exec(ctx,
		`UPDATE saved_sets
		 SET content = '', description = '',
		     frozen = true, frozen_auto = true,
		     revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
		 WHERE tombstone_id = @tombstone_id`,
		pgx.NamedArgs{"tombstone_id": tombstoneID},
	); err != nil {
		return fmt.Errorf("purge copied set bodies: %w", err)
	}
	return nil
}
