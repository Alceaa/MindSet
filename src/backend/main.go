package main

import (
	"log"
	"net/http"
	"os"

	"mindset/db"
	"mindset/routes"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

var dbUrl *string
var DB *pgx.Conn

func init() {
	if err := godotenv.Load(); err != nil {
		log.Print("No .env file")
	} else {
		db_url, exists := os.LookupEnv("DATABASE_URL")
		if exists {
			dbUrl = &db_url
		}
	}
}

func main() {
	if dbUrl != nil {
		DB = db.Open(*dbUrl)
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowCredentials: true,
		Debug:            true,
		AllowedMethods:   []string{"GET", "POST", "DELETE"},
	})
	r := routes.SetupRoutes()
	handler := cors.Default().Handler(r)
	handler = c.Handler(handler)
	log.Fatal(http.ListenAndServe(":8080", handler))
}
