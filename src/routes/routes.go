package routes

import (
	"mindset/handlers"
	"mindset/middlewares"

	"github.com/gofiber/fiber/v2"
	"github.com/gorilla/mux"
)

func SetupRoutes(app fiber.Router) *mux.Router {
	r := mux.NewRouter()

	authRoutes := app.Group("/auth")
	authRoutes.Post("/register", handlers.Register)
	authRoutes.Post("/login", handlers.Login)
	authRoutes.Get("/logout", middlewares.ValidateAccessToken, handlers.Logout)
	authRoutes.Get("/refresh", middlewares.ValidateRefreshToken, handlers.Refresh)
	//r.HandleFunc("/api/user", handlers.GetUser).Methods("POST")
	return r
}
