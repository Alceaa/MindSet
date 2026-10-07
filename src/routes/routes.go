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

	public := app.Group("/public")
	public.Get("/sets", handlers.GetPublicSets)
	public.Get("/sets/:slug", handlers.GetPublicSet)
	public.Get("/snapshots/:id", handlers.GetPublicSnapshot)

	saved := app.Group("/saved-sets", middlewares.ValidateAccessToken)
	saved.Get("", handlers.GetSavedSets)
	saved.Post("", middlewares.RequireJSONBody, handlers.SaveExternalSet)
	saved.Get("/:id", handlers.GetSavedSet)
	saved.Post("/:id/refresh", handlers.RefreshSavedSet)
	saved.Post("/:id/freeze", middlewares.RequireJSONBody, handlers.FreezeSavedSet)
	saved.Delete("/:id", handlers.DeleteSavedSet)

	app.Get("/graph", middlewares.ValidateAccessToken, handlers.GetGraph)
	sets.Get("/:id/copy-stats", handlers.GetSetCopyStats)

	app.Get("/set-tombstones", middlewares.ValidateAccessToken, handlers.GetSetTombstones)
	app.Post("/set-tombstones/:id/forbid-copies", middlewares.ValidateAccessToken, handlers.ForbidSetTombstone)
}
