package db

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/jackc/pgx/v5"
)

var c *pgx.Conn

var once sync.Once

func Open(url string) *pgx.Conn {
	once.Do(func() {
		c = connect(url)
	})
	return c
}

func connect(url string) *pgx.Conn {
	conn, err := pgx.Connect(context.Background(), url)

	if err != nil {
		log.Printf("Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())
	return conn
}
