package routes

import (
	"time"

	"mindset/handlers"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app fiber.Router) {
	cfg := utils.Config()

	authLimiter := middlewares.RateLimiter(middlewares.RateLimitRule{
		Name:        "auth",
		Max:         cfg.RateLimitAuthPer15Min,
		Expiration:  15 * time.Minute,
		SkipSuccess: true,
		KeyByLogin:  true,
	})
	emailLimiter := middlewares.RateLimiter(middlewares.RateLimitRule{
		Name:       "email",
		Max:        cfg.RateLimitEmailPerHour,
		Expiration: time.Hour,
	})
	reportLimiter := middlewares.RateLimiter(middlewares.RateLimitRule{
		Name:       "report",
		Max:        cfg.RateLimitReportPerHour,
		Expiration: time.Hour,
	})

	if cfg.AdminToken != "" {
		admin := app.Group("/admin", middlewares.OptionalAuth, handlers.RequireAdminToken)
		admin.Post("/invites", middlewares.RequireJSONBody, handlers.CreateInvite)
		admin.Get("/invites", handlers.ListInvites)
		admin.Delete("/invites/:id", handlers.RevokeInvite)
	}

	panel := app.Group("/admin", middlewares.ValidateAccessToken, handlers.RequireAdmin)
	panel.Get("/users", handlers.ListAdminUsers)
	panel.Post("/users/:id/block", middlewares.RequireJSONBody, handlers.BlockUser)
	panel.Post("/users/:id/unblock", handlers.UnblockUser)
	panel.Put("/users/:id/role", middlewares.RequireJSONBody, handlers.UpdateUserRole)
	panel.Get("/sets", handlers.ListAdminSets)
	panel.Delete("/sets/:id", handlers.DeleteAdminSet)
	panel.Get("/news", handlers.ListAdminNews)
	panel.Post("/news", middlewares.RequireJSONBody, handlers.CreateAdminNews)
	panel.Put("/news/:id", middlewares.RequireJSONBody, handlers.UpdateAdminNews)
	panel.Delete("/news/:id", handlers.DeleteAdminNews)
	panel.Get("/reports", handlers.ListAdminReports)
	panel.Put("/reports/:id/status", middlewares.RequireJSONBody, handlers.UpdateReportStatus)
	panel.Get("/actions", handlers.ListAdminActions)

	auth := app.Group("/auth")
	auth.Get("/config", handlers.RegistrationConfig)
	auth.Post("/register", emailLimiter, handlers.Register)
	auth.Post("/login", authLimiter, handlers.Login)
	auth.Post("/refresh", middlewares.ValidateRefreshToken, handlers.Refresh)
	auth.Post("/logout", handlers.Logout)
	auth.Get("/me", middlewares.ValidateAccessToken, handlers.Me)
	auth.Post("/login/confirm", authLimiter, middlewares.RequireJSONBody, handlers.ConfirmLogin)
	auth.Post("/verify-email", emailLimiter, middlewares.RequireJSONBody, handlers.VerifyEmail)
	auth.Post("/verify-email/request", middlewares.OptionalAuth, emailLimiter, middlewares.RequireJSONBody, handlers.RequestEmailVerification)
	auth.Post("/forgot", emailLimiter, middlewares.RequireJSONBody, handlers.ForgotPassword)
	auth.Post("/reset", authLimiter, middlewares.RequireJSONBody, handlers.ResetPassword)

	app.Get("/news", handlers.ListNews)
	app.Get("/news/:id", middlewares.OptionalAuth, handlers.GetNewsItem)
	app.Post("/reports", middlewares.OptionalAuth, reportLimiter, middlewares.RequireJSONBody, handlers.CreateBugReport)

	sets := app.Group("/sets", middlewares.ValidateAccessToken)
	sets.Get("", handlers.GetSets)
	sets.Post("", handlers.CreateSet)
	sets.Get("/:id", handlers.GetSet)
	sets.Put("/:id", handlers.UpdateSet)
	sets.Delete("/:id", handlers.DeleteSet)

	public := app.Group("/public")
	public.Get("/sets", middlewares.OptionalAuth, handlers.GetPublicSets)
	public.Get("/sets/:slug", handlers.GetPublicSet)
	public.Get("/sets/:slug/likes", middlewares.OptionalAuth, handlers.GetSetLikes)
	public.Get("/sets/:slug/comments", handlers.ListSetComments)
	public.Post("/sets/:slug/like", middlewares.ValidateAccessToken, handlers.LikeSet)
	public.Delete("/sets/:slug/like", middlewares.ValidateAccessToken, handlers.UnlikeSet)
	public.Post("/sets/:slug/comments", middlewares.ValidateAccessToken, middlewares.RequireJSONBody, handlers.CreateComment)
	public.Get("/snapshots/:id", handlers.GetPublicSnapshot)
	public.Get("/users/:login", middlewares.OptionalAuth, handlers.GetPublicProfile)
	public.Get("/users/:login/sets", middlewares.OptionalAuth, handlers.GetPublicUserSets)

	app.Get("/feed", middlewares.OptionalAuth, handlers.GetFeed)
	app.Delete("/comments/:id", middlewares.ValidateAccessToken, handlers.DeleteComment)

	users := app.Group("/users", middlewares.ValidateAccessToken)
	users.Put("/me", handlers.UpdateMe)
	users.Put("/me/password", handlers.ChangePassword)
	users.Put("/me/2fa", middlewares.RequireJSONBody, handlers.UpdateTwoFactor)
	users.Post("/me/logout-all", handlers.LogoutAll)
	users.Post("/me/avatar", handlers.UploadAvatar)
	users.Post("/:id/follow", handlers.Follow)
	users.Delete("/:id/follow", handlers.Unfollow)

	uploads := app.Group("/uploads", middlewares.ValidateAccessToken)
	uploads.Post("/presign", handlers.PresignUpload)

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
