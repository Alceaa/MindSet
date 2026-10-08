package utils

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	AccessTokenCookie  = "access_token"
	RefreshTokenCookie = "refresh_token"
)

func SetAuthCookies(c *fiber.Ctx, accessToken, refreshToken string) {
	accessMaxAge, refreshMaxAge := TokenMaxAges()
	if accessToken != "" {
		c.Cookie(authCookie(AccessTokenCookie, accessToken, accessMaxAge))
	}
	if refreshToken != "" {
		c.Cookie(authCookie(RefreshTokenCookie, refreshToken, refreshMaxAge))
	}
}

func ClearAuthCookies(c *fiber.Ctx) {
	c.Cookie(expiredCookie(AccessTokenCookie))
	c.Cookie(expiredCookie(RefreshTokenCookie))
}

func authCookie(name, value string, maxAge int) *fiber.Cookie {
	cfg := Config()
	return &fiber.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Domain:   cfg.CookieDomain,
		MaxAge:   maxAge,
		Expires:  time.Now().Add(time.Duration(maxAge) * time.Second),
		Secure:   cfg.SecureCookie(),
		HTTPOnly: true,
		SameSite: cfg.SameSite(),
	}
}

func expiredCookie(name string) *fiber.Cookie {
	cfg := Config()
	return &fiber.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		Domain:   cfg.CookieDomain,
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
		Secure:   cfg.SecureCookie(),
		HTTPOnly: true,
		SameSite: cfg.SameSite(),
	}
}
