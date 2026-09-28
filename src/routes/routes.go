package routes

import (
	"mindset/handlers"
	"mindset/middlewares"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app fiber.Router) {
	auth := app.Group("/auth")
	auth.Post("/register", handlers.Register)
	auth.Post("/login", handlers.Login)
	auth.Post("/refresh", middlewares.ValidateRefreshToken, handlers.Refresh)
	auth.Post("/logout", handlers.Logout)
	auth.Get("/me", middlewares.ValidateAccessToken, handlers.Me)

	sets := app.Group("/sets", middlewares.ValidateAccessToken)
	sets.Get("", handlers.GetSets)
	sets.Post("", handlers.CreateSet)
	sets.Get("/:id", handlers.GetSet)
	sets.Put("/:id", handlers.UpdateSet)
	sets.Delete("/:id", handlers.DeleteSet)
}
