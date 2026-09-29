package db

import (
	"context"
	"fmt"

	"mindset/links"
	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func ReplaceSetLinks(ctx context.Context, tx pgx.Tx, setID int, parsed []links.Link) error {
	if _, err := tx.Exec(
		ctx,
		`DELETE FROM set_links WHERE from_set_id = @set_id`,
		pgx.NamedArgs{"set_id": setID},
	); err != nil {
		return fmt.Errorf("clear set links: %w", err)
	}

	for _, link := range parsed {
		if _, err := tx.Exec(ctx, `INSERT INTO set_links (from_set_id, target_key, label, alias)
			VALUES (@set_id, @target_key, @label, @alias)
			ON CONFLICT (from_set_id, target_key)
			DO UPDATE SET label = EXCLUDED.label, alias = EXCLUDED.alias`,
			pgx.NamedArgs{
				"set_id":     setID,
				"target_key": link.Key,
				"label":      link.Label,
				"alias":      link.Alias,
			},
		); err != nil {
			return fmt.Errorf("insert set link: %w", err)
		}
	}

	return nil
}

func GetSetLinks(ctx context.Context, setID, userID int) ([]*models.SetLink, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `SELECT
	  l.label,
	  l.alias,
	  target.id,
	  target.title,
	  NOT EXISTS (
	    SELECT 1 FROM set_links back
	     WHERE back.from_set_id = target.id
	       AND back.target_key = (SELECT title_key FROM sets WHERE id = @set_id)
	  ) AS one_sided
	FROM set_links l
	JOIN sets target ON target.user_id = @user_id AND target.title_key = l.target_key
	WHERE l.from_set_id = @set_id
	ORDER BY l.id`

	rows, err := conn.Query(ctx, query, pgx.NamedArgs{"set_id": setID, "user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("list set links: %w", err)
	}
	defer rows.Close()

	result := make([]*models.SetLink, 0)
	for rows.Next() {
		var link models.SetLink
		if err := rows.Scan(
			&link.Label,
			&link.Alias,
			&link.TargetID,
			&link.TargetTitle,
			&link.OneSided,
		); err != nil {
			return nil, fmt.Errorf("scan set link: %w", err)
		}
		result = append(result, &link)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list set links: %w", err)
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
	       AND out.target_key = source.title_key
	  ) AS one_sided
	FROM set_links l
	JOIN sets source ON source.id = l.from_set_id
	WHERE l.target_key = (SELECT title_key FROM sets WHERE id = @set_id)
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
	  s.id,
	  s.title,
	  (SELECT count(*)
	     FROM set_links l
	     JOIN sets target ON target.user_id = s.user_id AND target.title_key = l.target_key
	    WHERE l.from_set_id = s.id) AS links_count,
	  (SELECT count(*)
	     FROM set_links l
	     JOIN sets source ON source.id = l.from_set_id
	    WHERE source.user_id = s.user_id
	      AND l.target_key = s.title_key
	      AND source.id <> s.id) AS backlinks_count,
	  to_char(s.last_activity, 'YYYY-MM-DD') AS updated
	FROM sets s
	WHERE s.user_id = @user_id
	ORDER BY s.id`

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
		if err := nodes.Scan(&node.ID, &node.Title, &linksOut, &linksIn, &node.Updated); err != nil {
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

	edgesQuery := `WITH directed AS (
    SELECT source.id AS from_id, target.id AS to_id
    FROM set_links l
    JOIN sets source ON source.id = l.from_set_id
    JOIN sets target ON target.user_id = source.user_id AND target.title_key = l.target_key
    WHERE source.user_id = @user_id AND target.id <> source.id
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
