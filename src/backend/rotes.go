package main

import (
	"mindset/handlers"
	"mindset/middlewares"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app fiber.Router) {
	authRoutes := app.Group("/auth")
	authRoutes.Post("/register", handlers.Register)
	authRoutes.Post("/login", handlers.Login)
	authRoutes.Get("/logout", middlewares.ValidateUserToken, handlers.Logout)

}
