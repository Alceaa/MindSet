package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/links"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func ReplaceSetLinks(ctx context.Context, tx pgx.Tx, setID, userID int, parsed []links.Link) error {
	keys := links.Keys(parsed)

	if len(keys) == 0 {
		if _, err := tx.Exec(
			ctx,
			`DELETE FROM set_links WHERE from_set_id = @set_id`,
			pgx.NamedArgs{"set_id": setID},
		); err != nil {
			return fmt.Errorf("clear set links: %w", err)
		}
	} else if _, err := tx.Exec(
		ctx,
		`DELETE FROM set_links WHERE from_set_id = @set_id AND target_key <> ALL(@keys)`,
		pgx.NamedArgs{"set_id": setID, "keys": keys},
	); err != nil {
		return fmt.Errorf("clear set links: %w", err)
	}

	for _, link := range parsed {
		targetID, targetUserID, err := resolveLinkTarget(ctx, tx, setID, userID, link)
		if err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, `INSERT INTO set_links
			(from_set_id, target_key, label, alias, to_set_id, target_user_id, resolved_once, target_login, target_slug)
			VALUES (@set_id, @target_key, @label, @alias, @to_set_id, @target_user_id, @resolved_once, @target_login, @target_slug)
			ON CONFLICT (from_set_id, target_key)
			DO UPDATE SET
			  label = EXCLUDED.label,
			  alias = EXCLUDED.alias,
			  to_set_id = coalesce(EXCLUDED.to_set_id, set_links.to_set_id),
			  target_user_id = coalesce(EXCLUDED.target_user_id, set_links.target_user_id),
			  target_login = EXCLUDED.target_login,
			  target_slug = EXCLUDED.target_slug,
			  resolved_once = set_links.resolved_once OR EXCLUDED.resolved_once`,
			pgx.NamedArgs{
				"set_id":         setID,
				"target_key":     link.Key,
				"label":          link.Label,
				"alias":          link.Alias,
				"to_set_id":      optionalInt(targetID),
				"target_user_id": optionalInt(targetUserID),
				"resolved_once":  targetID != 0,
				"target_login":   link.Login,
				"target_slug":    link.Slug,
			},
		); err != nil {
			return fmt.Errorf("insert set link: %w", err)
		}
	}

	return nil
}

func resolveLinkTarget(ctx context.Context, tx pgx.Tx, setID, userID int, link links.Link) (int, int, error) {
	query := `SELECT s.id, s.user_id
	FROM sets s
	JOIN sets source ON source.id = @set_id
	WHERE s.user_id = source.user_id
	  AND s.title_key = @target_key
	LIMIT 1`
	args := pgx.NamedArgs{"set_id": setID, "user_id": userID, "target_key": link.Key}

	if link.Login != "" && link.Slug != "" {
		query = `SELECT s.id, s.user_id
	FROM sets s
	JOIN users u ON u.id = s.user_id
	WHERE lower(u.login) = lower(@login)
	  AND s.slug = @slug
	  AND s.visibility IN ('public', 'unlisted')
	LIMIT 1`
		args["login"] = link.Login
		args["slug"] = link.Slug
	}

	var targetID, targetUserID int
	err := tx.QueryRow(ctx, query, args).Scan(&targetID, &targetUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("resolve link target: %w", err)
	}

	return targetID, targetUserID, nil
}

func optionalInt(value int) any {
	if value == 0 {
		return nil
	}
	return value
}

func GetSetLinks(ctx context.Context, setID, userID int) ([]*models.SetLink, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT
	  l.label,
	  l.alias,
	  coalesce(target.id, 0) AS target_id,
	  coalesce(target.title, '') AS target_title,
	  coalesce(target.slug, '') AS target_slug,
	  coalesce(l.target_user_id, 0) AS target_user_id,
	  (coalesce(target.user_id, 0) = @user_id) AS own,
	  (target.id IS NULL) AS broken,
	  l.resolved_once,
	  NOT EXISTS (
	    SELECT 1 FROM set_links back
	     WHERE back.from_set_id = target.id
	       AND back.to_set_id = @set_id
	  ) AS one_sided,
	  coalesce(target.visibility, '') AS target_visibility,
	  coalesce(to_char(target.last_activity, 'YYYY-MM-DD'), '') AS target_last_activity,
	  l.target_login,
	  l.target_slug,
	  coalesce(ss.id, 0) AS snapshot_id,
	  coalesce(ss.title, '') AS snapshot_title,
	  coalesce(ss.frozen, false) AS snapshot_frozen,
	  coalesce(to_char(ss.revoked_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS snapshot_revoked_at,
	  coalesce(to_char(ss.last_update, 'YYYY-MM-DD'), '') AS snapshot_last_update
	FROM set_links l
	LEFT JOIN sets target ON target.id = l.to_set_id
	LEFT JOIN saved_sets ss
	  ON ss.owner_user_id = @user_id
	 AND ss.set_id = l.to_set_id
	WHERE l.from_set_id = @set_id
	  AND coalesce(target.id, 0) <> @set_id
	ORDER BY l.id`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"set_id": setID, "user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list set links: %w", err)
	}
	defer rows.Close()

	result := make([]*models.SetLink, 0)
	for rows.Next() {
		var (
			link             models.SetLink
			targetVisibility string
			snapshot         models.SavedSet
		)
		if err := rows.Scan(
			&link.Label,
			&link.Alias,
			&link.TargetID,
			&link.TargetTitle,
			&link.TargetSlug,
			&link.TargetUserID,
			&link.Own,
			&link.Broken,
			&link.ResolvedOnce,
			&link.OneSided,
			&targetVisibility,
			&link.TargetActivity,
			&link.TargetLogin,
			&link.TargetSlugKey,
			&snapshot.ID,
			&snapshot.Title,
			&snapshot.Frozen,
			&snapshot.RevokedAt,
			&snapshot.LastUpdate,
		); err != nil {
			return nil, fmt.Errorf("scan set link: %w", err)
		}

		link.LiveAvailable = targetVisibility == "public" || targetVisibility == "unlisted"
		if snapshot.ID != 0 {
			snapshot.SetID = link.TargetID
			snapshot.LiveActivity = link.TargetActivity
			link.SnapshotID = snapshot.ID
			link.SnapshotTitle = snapshot.Title
			link.SnapshotState = string(SnapshotStateOf(&snapshot, models.Visibility(targetVisibility)))
		}
		result = append(result, &link)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list set links: %w", err)
	}

	if err := annotateLinksWithSnapshots(ctx, userID, result); err != nil {
		return nil, err
	}

	return result, nil
}

func annotateLinksWithSnapshots(ctx context.Context, userID int, links []*models.SetLink) error {
	missing := make([]*models.SetLink, 0)
	for _, link := range links {
		if link.SnapshotID == 0 && link.TargetLogin != "" && link.TargetSlugKey != "" {
			missing = append(missing, link)
		}
	}

	for _, link := range missing {
		saved, err := GetSavedSetBySource(ctx, userID, link.TargetLogin, link.TargetSlugKey)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				continue
			}
			return err
		}

		if err := AnnotateSavedSets(ctx, userID, []*models.SavedSet{saved}); err != nil {
			return err
		}

		link.SnapshotID = saved.ID
		link.SnapshotTitle = saved.Title
		link.SnapshotState = string(saved.State)
	}

	return nil
}

func GetPublicSetLinks(ctx context.Context, setID, ownerUserID int) ([]*models.SetLink, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT
	  l.label,
	  l.alias,
	  coalesce(target.id, 0) AS target_id,
	  coalesce(target.title, '') AS target_title,
	  coalesce(target.slug, '') AS target_slug,
	  coalesce(l.target_user_id, 0) AS target_user_id,
	  coalesce(ss.id, 0) AS snapshot_id,
	  coalesce(ss.title, '') AS snapshot_title,
	  coalesce(ss.frozen, false) AS snapshot_frozen,
	  coalesce(to_char(ss.revoked_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS snapshot_revoked_at,
	  coalesce(to_char(ss.last_update, 'YYYY-MM-DD'), '') AS snapshot_last_update,
	  coalesce(to_char(target.last_activity, 'YYYY-MM-DD'), '') AS target_last_activity,
	  coalesce(target.visibility, '') AS target_visibility
	FROM set_links l
	LEFT JOIN sets target ON target.id = l.to_set_id
	LEFT JOIN saved_sets ss
	  ON ss.owner_user_id = @owner_user_id
	 AND (
	      (l.to_set_id IS NOT NULL AND ss.set_id = l.to_set_id)
	   OR (l.to_set_id IS NULL
	       AND l.target_login <> ''
	       AND l.target_slug <> ''
	       AND lower(ss.source_login) = lower(l.target_login)
	       AND ss.source_slug = l.target_slug)
	 )
	WHERE l.from_set_id = @set_id
	  AND (
	    target.visibility IN ('public', 'unlisted')
	    OR (target.id IS NULL AND ss.id IS NOT NULL AND ss.revoked_at IS NULL)
	  )
	  AND target.id IS DISTINCT FROM @set_id
	ORDER BY l.id`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{
		"set_id":        setID,
		"owner_user_id": ownerUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("list public set links: %w", err)
	}
	defer rows.Close()

	result := make([]*models.SetLink, 0)
	for rows.Next() {
		var (
			link             models.SetLink
			snapshot         models.SavedSet
			targetVisibility string
		)
		if err := rows.Scan(
			&link.Label,
			&link.Alias,
			&link.TargetID,
			&link.TargetTitle,
			&link.TargetSlug,
			&link.TargetUserID,
			&snapshot.ID,
			&snapshot.Title,
			&snapshot.Frozen,
			&snapshot.RevokedAt,
			&snapshot.LastUpdate,
			&link.TargetActivity,
			&targetVisibility,
		); err != nil {
			return nil, fmt.Errorf("scan public set link: %w", err)
		}

		link.ResolvedOnce = true
		link.LiveAvailable = targetVisibility == "public" || targetVisibility == "unlisted"
		if snapshot.ID != 0 {
			link.SnapshotID = snapshot.ID
			link.SnapshotTitle = snapshot.Title
			snapshot.SetID = link.TargetID
			snapshot.LiveActivity = link.TargetActivity
			link.SnapshotState = string(SnapshotStateOf(&snapshot, models.Visibility(targetVisibility)))
		}
		result = append(result, &link)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list public set links: %w", err)
	}

	return result, nil
}

func GetBacklinks(ctx context.Context, setID, userID int) ([]*models.Backlink, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT
	  source.id,
	  source.title,
	  NOT EXISTS (
	    SELECT 1 FROM set_links out
	     WHERE out.from_set_id = @set_id
	       AND out.to_set_id = source.id
	  ) AS one_sided
	FROM set_links l
	JOIN sets source ON source.id = l.from_set_id
	WHERE l.to_set_id = @set_id
	  AND source.user_id = @user_id
	  AND source.id <> @set_id
	ORDER BY source.title`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"set_id": setID, "user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list backlinks: %w", err)
	}
	defer rows.Close()

	result := make([]*models.Backlink, 0)
	for rows.Next() {
		var backlink models.Backlink
		if err := rows.Scan(&backlink.ID, &backlink.Title, &backlink.OneSided); err != nil {
			return nil, fmt.Errorf("scan backlink: %w", err)
		}
		result = append(result, &backlink)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list backlinks: %w", err)
	}

	return result, nil
}

func GetGraph(ctx context.Context, userID int) (*models.Graph, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	graph := &models.Graph{
		Nodes: make([]models.GraphNode, 0),
		Edges: make([]models.GraphEdge, 0),
	}

	nodesQuery := `SELECT
	  n.id,
	  n.title,
	  n.links_count,
	  n.backlinks_count,
	  to_char(n.last_activity, 'YYYY-MM-DD') AS updated,
	  n.own,
	  n.slug,
	  n.login,
	  n.snapshot_id
	FROM (
	  SELECT
	    s.id,
	    s.title,
	    (SELECT count(*)
	       FROM set_links l
	       JOIN sets target ON target.id = l.to_set_id
	      WHERE l.from_set_id = s.id
	        AND target.id <> s.id) AS links_count,
	    (SELECT count(*)
	       FROM set_links l
	       JOIN sets source ON source.id = l.from_set_id
	      WHERE l.to_set_id = s.id
	        AND source.user_id = s.user_id
	        AND source.id <> s.id) AS backlinks_count,
	    s.last_activity,
	    true AS own,
	    s.slug,
	    u.login,
	    0 AS snapshot_id
	  FROM sets s
	  JOIN users u ON u.id = s.user_id
	  WHERE s.user_id = @user_id

	  UNION ALL

	  SELECT
	    t.id,
	    t.title,
	    0,
	    (SELECT count(*)
	       FROM set_links l
	       JOIN sets source ON source.id = l.from_set_id
	      WHERE l.to_set_id = t.id
	        AND source.user_id = @user_id
	        AND source.id <> t.id),
	    t.last_activity,
	    false,
	    t.slug,
	    tu.login,
	    coalesce(ss.id, 0)
	  FROM (
	    SELECT DISTINCT l.to_set_id AS id
	    FROM set_links l
	    JOIN sets source ON source.id = l.from_set_id
	    WHERE source.user_id = @user_id
	      AND l.to_set_id IS NOT NULL
	  ) refs
	  JOIN sets t ON t.id = refs.id
	  JOIN users tu ON tu.id = t.user_id
	  LEFT JOIN saved_sets ss
	    ON ss.owner_user_id = @user_id
	   AND ss.set_id = t.id
	  WHERE t.user_id <> @user_id
	    AND t.visibility IN ('public', 'unlisted')
	) n
	ORDER BY n.own DESC, n.id`

	nodes, err := conn.Query(ctx, nodesQuery, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("graph nodes: %w", err)
	}

	for nodes.Next() {
		var (
			node     models.GraphNode
			linksOut int64
			linksIn  int64
		)
		if err := nodes.Scan(
			&node.ID,
			&node.Title,
			&linksOut,
			&linksIn,
			&node.Updated,
			&node.Own,
			&node.Slug,
			&node.Login,
			&node.SnapshotID,
		); err != nil {
			nodes.Close()
			return nil, fmt.Errorf("scan graph node: %w", err)
		}
		node.Links = int(linksOut)
		node.Backlinks = int(linksIn)
		graph.Nodes = append(graph.Nodes, node)
	}
	nodes.Close()

	if err := nodes.Err(); err != nil {
		return nil, fmt.Errorf("graph nodes: %w", err)
	}

	edgesQuery := `WITH scope AS (
    SELECT l.to_set_id AS ext_id
    FROM set_links l
    JOIN sets source ON source.id = l.from_set_id
    JOIN sets target ON target.id = l.to_set_id
    WHERE source.user_id = @user_id
      AND target.user_id <> @user_id
      AND target.visibility IN ('public', 'unlisted')
),
directed AS (
    SELECT source.id AS from_id, target.id AS to_id
    FROM set_links l
    JOIN sets source ON source.id = l.from_set_id
    JOIN sets target ON target.id = l.to_set_id
    WHERE target.id <> source.id
      AND (
        (
          source.user_id = @user_id
          AND (
            target.user_id = @user_id
            OR target.visibility IN ('public', 'unlisted')
          )
        )
        OR (
          target.user_id = @user_id
          AND source.id IN (SELECT ext_id FROM scope)
        )
      )
)
SELECT
    CASE WHEN p.directions > 1 OR p.low_to_high THEN p.low  ELSE p.high END AS from_id,
    CASE WHEN p.directions > 1 OR p.low_to_high THEN p.high ELSE p.low  END AS to_id,
    (p.directions = 1) AS one_sided
FROM (
    SELECT
        LEAST(from_id, to_id) AS low,
        GREATEST(from_id, to_id) AS high,
        count(*) AS directions,
        bool_or(from_id = LEAST(from_id, to_id)) AS low_to_high
    FROM directed
    GROUP BY LEAST(from_id, to_id), GREATEST(from_id, to_id)
) p
ORDER BY 1, 2`

	edges, err := conn.Query(ctx, edgesQuery, pgx.NamedArgs{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("graph edges: %w", err)
	}
	defer edges.Close()

	for edges.Next() {
		var edge models.GraphEdge
		if err := edges.Scan(&edge.From, &edge.To, &edge.OneSided); err != nil {
			return nil, fmt.Errorf("scan graph edge: %w", err)
		}
		graph.Edges = append(graph.Edges, edge)
	}
	if err := edges.Err(); err != nil {
		return nil, fmt.Errorf("graph edges: %w", err)
	}

	return graph, nil
}
