package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func IsFollowing(ctx context.Context, followerID, followedID int) (bool, error) {
	conn, err := pool()
	if err != nil {
		return false, err
	}

	var following bool
	err = conn.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM follows
			WHERE follower_id = @follower_id AND followed_id = @followed_id
		)`,
		pgx.NamedArgs{"follower_id": followerID, "followed_id": followedID},
	).Scan(&following)
	if err != nil {
		return false, fmt.Errorf("check follow: %w", err)
	}
	return following, nil
}

func FollowUser(ctx context.Context, followerID, followedID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`INSERT INTO follows (follower_id, followed_id)
		 VALUES (@follower_id, @followed_id)
		 ON CONFLICT DO NOTHING`,
		pgx.NamedArgs{"follower_id": followerID, "followed_id": followedID},
	)
	if err != nil {
		return fmt.Errorf("follow user: %w", err)
	}
	return nil
}

func UnfollowUser(ctx context.Context, followerID, followedID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`DELETE FROM follows
		 WHERE follower_id = @follower_id AND followed_id = @followed_id`,
		pgx.NamedArgs{"follower_id": followerID, "followed_id": followedID},
	)
	if err != nil {
		return fmt.Errorf("unfollow user: %w", err)
	}
	return nil
}

func FollowCounts(ctx context.Context, userID int) (followers int, following int, err error) {
	conn, err := pool()
	if err != nil {
		return 0, 0, err
	}

	err = conn.QueryRow(ctx,
		`SELECT
			(SELECT count(*) FROM follows WHERE followed_id = @id),
			(SELECT count(*) FROM follows WHERE follower_id = @id)`,
		pgx.NamedArgs{"id": userID},
	).Scan(&followers, &following)
	if err != nil {
		return 0, 0, fmt.Errorf("follow counts: %w", err)
	}
	return followers, following, nil
}
