package db

import (
	"context"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

func SetLike(ctx context.Context, setID, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`INSERT INTO set_likes (set_id, user_id) VALUES (@set_id, @user_id)
		 ON CONFLICT DO NOTHING`,
		pgx.NamedArgs{"set_id": setID, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("like set: %w", err)
	}
	return nil
}

func SetUnlike(ctx context.Context, setID, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`DELETE FROM set_likes WHERE set_id = @set_id AND user_id = @user_id`,
		pgx.NamedArgs{"set_id": setID, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("unlike set: %w", err)
	}
	return nil
}

func LikeState(ctx context.Context, setID, userID int) (liked bool, count int, err error) {
	conn, err := pool()
	if err != nil {
		return false, 0, err
	}

	err = conn.QueryRow(ctx,
		`SELECT
			(SELECT count(*) FROM set_likes WHERE set_id = @set_id) AS likes_count,
			(@user_id > 0 AND EXISTS(
				SELECT 1 FROM set_likes WHERE set_id = @set_id AND user_id = @user_id
			)) AS liked`,
		pgx.NamedArgs{"set_id": setID, "user_id": userID},
	).Scan(&count, &liked)
	if err != nil {
		return false, 0, fmt.Errorf("like state: %w", err)
	}
	return liked, count, nil
}

func ListComments(ctx context.Context, setID int) ([]*models.Comment, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx,
		`SELECT c.id, c.set_id, c.user_id, u.login, coalesce(u.avatar, '') AS avatar, c.body,
		        to_char(c.date_created, 'YYYY-MM-DD HH24:MI') AS date_created
		 FROM set_comments c
		 JOIN users u ON u.id = c.user_id
		 WHERE c.set_id = @set_id
		 ORDER BY c.id ASC`,
		pgx.NamedArgs{"set_id": setID},
	)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	comments := make([]*models.Comment, 0)
	for rows.Next() {
		var comment models.Comment
		if err := rows.Scan(
			&comment.ID,
			&comment.SetID,
			&comment.UserID,
			&comment.Login,
			&comment.Avatar,
			&comment.Body,
			&comment.DateCreated,
		); err != nil {
			return nil, fmt.Errorf("scan comment: %w", err)
		}
		comments = append(comments, &comment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	return comments, nil
}

func CreateComment(ctx context.Context, setID, userID int, body string) (*models.Comment, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	comment := &models.Comment{SetID: setID, UserID: userID, Body: body}
	err = conn.QueryRow(ctx,
		`INSERT INTO set_comments (set_id, user_id, body) VALUES (@set_id, @user_id, @body)
		 RETURNING id, to_char(date_created, 'YYYY-MM-DD HH24:MI') AS date_created`,
		pgx.NamedArgs{"set_id": setID, "user_id": userID, "body": body},
	).Scan(&comment.ID, &comment.DateCreated)
	if err != nil {
		return nil, fmt.Errorf("create comment: %w", err)
	}
	return comment, nil
}

func DeleteComment(ctx context.Context, commentID, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`DELETE FROM set_comments WHERE id = @id AND user_id = @user_id`,
		pgx.NamedArgs{"id": commentID, "user_id": userID},
	)
	if err != nil {
		return fmt.Errorf("delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func ListAnnouncements(ctx context.Context, limit int) ([]*models.Announcement, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx,
		`SELECT id, title, body, is_pinned, to_char(published_at, 'YYYY-MM-DD') AS date_posted
		 FROM news
		 WHERE is_published
		 ORDER BY is_pinned DESC, published_at DESC
		 LIMIT @limit`,
		pgx.NamedArgs{"limit": limit},
	)
	if err != nil {
		return nil, fmt.Errorf("list announcements: %w", err)
	}
	defer rows.Close()

	announcements := make([]*models.Announcement, 0)
	for rows.Next() {
		var announcement models.Announcement
		if err := rows.Scan(
			&announcement.ID,
			&announcement.Title,
			&announcement.Body,
			&announcement.IsPinned,
			&announcement.DatePosted,
		); err != nil {
			return nil, fmt.Errorf("scan announcement: %w", err)
		}
		announcements = append(announcements, &announcement)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list announcements: %w", err)
	}
	return announcements, nil
}

func scanPublicSets(rows pgx.Rows) ([]*models.Set, error) {
	sets := make([]*models.Set, 0)
	for rows.Next() {
		set, err := scanPublicSet(rows)
		if err != nil {
			return nil, err
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sets, nil
}

func FeedFollowingSets(ctx context.Context, viewerID, limit int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx,
		`SELECT `+publicSetColumns+`
		 FROM sets s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.visibility = 'public'
		   AND u.blocked_at IS NULL
		   AND s.user_id IN (SELECT followed_id FROM follows WHERE follower_id = @viewer)
		 ORDER BY s.last_activity DESC, s.id DESC
		 LIMIT @limit`,
		pgx.NamedArgs{"viewer": viewerID, "limit": limit},
	)
	if err != nil {
		return nil, fmt.Errorf("feed following: %w", err)
	}
	defer rows.Close()

	return scanPublicSets(rows)
}

func FeedPopularSets(ctx context.Context, viewerID, limit int) ([]*models.Set, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx,
		`SELECT `+publicSetColumns+`
		 FROM sets s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.visibility = 'public'
		   AND u.blocked_at IS NULL
		   AND s.last_activity >= CURRENT_DATE - 7
		 ORDER BY (
		     (SELECT count(*) FROM set_likes l WHERE l.set_id = s.id)
		   + (SELECT count(*) FROM set_comments cm WHERE cm.set_id = s.id)
		   + (SELECT count(*) FROM set_links sl WHERE sl.to_set_id = s.id)
		 ) DESC, s.last_activity DESC
		 LIMIT @limit`,
		pgx.NamedArgs{"viewer": viewerID, "limit": limit},
	)
	if err != nil {
		return nil, fmt.Errorf("feed popular: %w", err)
	}
	defer rows.Close()

	return scanPublicSets(rows)
}
