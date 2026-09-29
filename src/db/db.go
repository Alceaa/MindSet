package db

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound       = errors.New("record not found")
	ErrNotInitialized = errors.New("database is not initialized")
)

type Postgres struct {
	db *pgxpool.Pool
}

var (
	pgInstance *Postgres
	once       sync.Once
	openErr    error
)

// Open создаёт пул соединений ровно один раз за время жизни процесса.
func Open(url string) error {
	once.Do(func() {
		ctx := context.Background()

		conn, err := pgxpool.New(ctx, url)
		if err != nil {
			openErr = fmt.Errorf("unable to create connection pool: %w", err)
			return
		}

		if err := conn.Ping(ctx); err != nil {
			openErr = fmt.Errorf("unable to connect to database: %w", err)
			conn.Close()
			return
		}

		pgInstance = &Postgres{db: conn}
		log.Print("Connected to database")
	})
	return openErr
}

// Close закрывает пул. Вызывается при graceful shutdown.
func Close() {
	if pgInstance == nil || pgInstance.db == nil {
		return
	}
	pgInstance.db.Close()
}

// Health проверяет живое соединение с БД (используется в /health).
func Health(ctx context.Context) error {
	pool, err := pool()
	if err != nil {
		return err
	}
	return pool.Ping(ctx)
}

// pool возвращает пул или ошибку, если Open не выполнялся. Так вместо паники
// при nil-указателе возвращается понятная ошибка.
func pool() (*pgxpool.Pool, error) {
	if pgInstance == nil || pgInstance.db == nil {
		return nil, ErrNotInitialized
	}
	return pgInstance.db, nil
}

func WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	conn, err := pool()
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if err := fn(tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
