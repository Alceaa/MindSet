package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/csrf"

	"mindset/db"
	"mindset/routes"
	"mindset/utils"
)

var dbUrl *string

func init() {
	config, err := utils.LoadEnv(".")
	if err != nil {
		log.Print("No .env file")
	} else {
		log.Print("Env loaded")
		dbUrl = &config.DBUrl
	}
}

func main() {
	if dbUrl != nil {
		db.Open(*dbUrl)
	} else {
		log.Print("No dbUrl in env file")
	}

	app := fiber.New()

	routes.SetupRoutes(app)

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000",
		AllowHeaders:     "Origin, Content-Type, Accept",
		AllowMethods:     "GET, POST",
		AllowCredentials: true,
	}))

	app.Use(func(c *fiber.Ctx) error {
		if c.Is("json") {
			return c.Next()
		}
		return c.SendString("Only JSON allowed!")
	})

	app.Use(csrf.New())

	log.Fatal(app.Listen(":8080"))
}
