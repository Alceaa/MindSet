package db

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	db *pgxpool.Pool
}

var (
	pgInstance *Postgres
	once       sync.Once
)

func Open(url string) {
	once.Do(func() {
		conn, err := pgxpool.New(context.Background(), url)

		if err != nil {
			log.Printf("Unable to connect to database: %v\n", err)
			os.Exit(1)
		}
		pgInstance = &Postgres{conn}
		pgInstance.Ping(context.Background())
		log.Printf("Connected to database")
	})
}

func (pg *Postgres) Ping(ctx context.Context) error {
	return pg.db.Ping(ctx)
}

func (pg *Postgres) Close() {
	pg.db.Close()
}
