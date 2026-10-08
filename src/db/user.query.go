package db

import (
	"context"
	"errors"
	"fmt"

	"mindset/models"

	"github.com/jackc/pgx/v5"
)

const userColumns = `id, login, email, password, coalesce(bio, '') AS bio, coalesce(avatar, '') AS avatar, coalesce(to_char(date_joined, 'YYYY-MM-DD'), '') AS date_joined, email_verified, two_factor_email, role, coalesce(to_char(blocked_at, 'YYYY-MM-DD HH24:MI'), '') AS blocked_at, coalesce(blocked_reason, '') AS blocked_reason, token_epoch`

func scanUser(row pgx.Row) (*models.User, error) {
	var user models.User
	err := row.Scan(&user.ID, &user.Login, &user.Email, &user.Password, &user.Bio, &user.Avatar, &user.DateJoined, &user.EmailVerified, &user.TwoFactorEmail, &user.Role, &user.BlockedAt, &user.BlockedReason, &user.TokenEpoch)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}
	return &user, nil
}

func CreateUser(ctx context.Context, user *models.User) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}
	query := `INSERT INTO users (login, email, password) VALUES
	(@login, @email, @password)
	RETURNING ` + userColumns

	row := conn.QueryRow(ctx, query, pgx.NamedArgs{
		"login":    user.Login,
		"email":    user.Email,
		"password": user.Password,
	})

	created, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return created, nil
}

func GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE email = @email`

	return getSingleUser(ctx, "get user by email", query, pgx.NamedArgs{"email": email})
}

func GetUserByLogin(ctx context.Context, login string) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE lower(login) = lower(@login)`

	return getSingleUser(ctx, "get user by login", query, pgx.NamedArgs{"login": login})
}

func GetUserById(ctx context.Context, id int) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE id = @id`

	return getSingleUser(ctx, "get user by id", query, pgx.NamedArgs{"id": id})
}

func FindLoginOrEmailConflict(ctx context.Context, login, email string) (loginTaken bool, emailTaken bool, err error) {
	conn, err := pool()
	if err != nil {
		return false, false, err
	}

	query := `SELECT
	  EXISTS(SELECT 1 FROM users WHERE lower(login) = lower(@login)),
	  EXISTS(SELECT 1 FROM users WHERE email = @email)`

	err = conn.QueryRow(ctx, query, pgx.NamedArgs{"login": login, "email": email}).
		Scan(&loginTaken, &emailTaken)
	if err != nil {
		return false, false, fmt.Errorf("check login/email conflict: %w", err)
	}
	return loginTaken, emailTaken, nil
}

const profileQuery = `SELECT
	u.id,
	u.login,
	coalesce(u.avatar, '') AS avatar,
	coalesce(u.bio, '') AS bio,
	coalesce(to_char(u.date_joined, 'YYYY-MM-DD'), '') AS date_joined,
	coalesce((SELECT to_char(MAX(last_activity), 'YYYY-MM-DD')
	          FROM sets
	          WHERE user_id = u.id AND visibility = 'public'), '') AS last_public_activity,
	(SELECT count(*) FROM sets WHERE user_id = u.id AND visibility = 'public') AS public_set_count,
	(SELECT count(*) FROM sets WHERE user_id = u.id AND visibility <> 'public') AS private_set_count,
	(SELECT count(*) FROM follows WHERE followed_id = u.id) AS followers_count,
	(SELECT count(*) FROM follows WHERE follower_id = u.id) AS following_count
FROM users u
WHERE lower(u.login) = lower(@login)
  AND u.blocked_at IS NULL`

func GetProfileByLogin(ctx context.Context, login string) (*models.Profile, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	var profile models.Profile
	err = conn.QueryRow(ctx, profileQuery, pgx.NamedArgs{"login": login}).Scan(
		&profile.ID,
		&profile.Login,
		&profile.Avatar,
		&profile.Bio,
		&profile.DateJoined,
		&profile.LastPublicActivity,
		&profile.PublicSetCount,
		&profile.PrivateSetCount,
		&profile.FollowersCount,
		&profile.FollowingCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get profile: %w", err)
	}
	return &profile, nil
}

func UpdateUserBio(ctx context.Context, userID int, bio string) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `UPDATE users SET bio = @bio WHERE id = @id RETURNING ` + userColumns
	updated, err := scanUser(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": userID, "bio": bio}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update user bio: %w", err)
	}
	return updated, nil
}

func UpdatePassword(ctx context.Context, userID int, hashed string) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`UPDATE users SET password = @password WHERE id = @id`,
		pgx.NamedArgs{"password": hashed, "id": userID},
	)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func BumpTokenEpoch(ctx context.Context, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx,
		`UPDATE users SET token_epoch = token_epoch + 1 WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	)
	if err != nil {
		return fmt.Errorf("bump token epoch: %w", err)
	}
	return nil
}

func SetEmailVerified(ctx context.Context, userID int) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tag, err := conn.Exec(ctx,
		`UPDATE users SET email_verified = true WHERE id = @id`,
		pgx.NamedArgs{"id": userID},
	)
	if err != nil {
		return fmt.Errorf("set email verified: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func SetTwoFactorEmail(ctx context.Context, userID int, enabled bool) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `UPDATE users SET two_factor_email = @enabled WHERE id = @id RETURNING ` + userColumns
	updated, err := scanUser(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": userID, "enabled": enabled}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set two factor email: %w", err)
	}
	return updated, nil
}

func SetUserAvatar(ctx context.Context, userID int, avatar string) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	query := `UPDATE users SET avatar = @avatar WHERE id = @id RETURNING ` + userColumns
	updated, err := scanUser(conn.QueryRow(ctx, query, pgx.NamedArgs{"id": userID, "avatar": avatar}))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set user avatar: %w", err)
	}
	return updated, nil
}

func getSingleUser(ctx context.Context, operation, query string, args pgx.NamedArgs) (*models.User, error) {
	conn, err := pool()
	if err != nil {
		return nil, err
	}

	user, err := scanUser(conn.QueryRow(ctx, query, args))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("%s: %w", operation, err)
	}
	return user, nil
}
