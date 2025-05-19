package middlewares

import (
	"context"
	"fmt"
	"mindset/db"
	"mindset/models"
	"mindset/utils"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt"
)

func ValidateAccessToken(c *fiber.Ctx) error {
	var access string
	authorization := c.Get("Authorization")

	if strings.HasPrefix(authorization, "Bearer ") {
		access = strings.TrimPrefix(authorization, "Bearer ")
	} else if c.Cookies("access_token") != "" {
		access = c.Cookies("access_token")
	}

	if access == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": "User is not logged in"})
	}

	config, _ := utils.LoadEnv(".")
	tokenByte, err := jwt.Parse(access, func(jwtToken *jwt.Token) (interface{}, error) {
		if _, ok := jwtToken.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %s", jwtToken.Header["alg"])
		}

		return []byte(config.JwtAccessSecret), nil
	})

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": fmt.Sprintf("invalidate access_token: %v", err)})
	}

	claims, ok := tokenByte.Claims.(jwt.MapClaims)
	if !ok || !tokenByte.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": "invalid access_token claim"})

	}

	var user models.User
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	db.GetUserById(ctx, fmt.Sprint(claims["sub"]), &user)

	if user.ID != claims["sub"] {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"status": "fail", "message": "the user belonging to this access_token no logger exists"})
	}

	c.Locals("user", user)

	return c.Next()
}

func ValidateRefreshToken(c *fiber.Ctx) error {
	var refresh string
	if c.Cookies("refresh_token") != "" {
		refresh = c.Cookies("refresh_token")
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": "User is not logged in"})
	}

	config, _ := utils.LoadEnv(".")
	tokenByte, err := jwt.Parse(refresh, func(jwtToken *jwt.Token) (interface{}, error) {
		if _, ok := jwtToken.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %s", jwtToken.Header["alg"])
		}

		return []byte(config.JwtRefreshSecret), nil
	})

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": fmt.Sprintf("invalidate refresh_token: %v", err)})
	}

	claims, ok := tokenByte.Claims.(jwt.MapClaims)
	if !ok || !tokenByte.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "fail", "message": "invalid refresh_token claim"})

	}

	var user models.User
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	db.GetUserById(ctx, fmt.Sprint(claims["sub"]), &user)

	if user.ID != claims["sub"] {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"status": "fail", "message": "the user belonging to this refresh_token no logger exists"})
	}

	c.Locals("user", user)

	return c.Next()
}
