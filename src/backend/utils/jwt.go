package utils

import (
	"mindset/models"
	"time"

	"github.com/golang-jwt/jwt"
)

func CreateAccessToken(user *models.User) (string, error) {
	config, _ := LoadEnv(".")
	tokenByte := jwt.New(jwt.SigningMethodHS256)
	now := time.Now().UTC()
	claims := tokenByte.Claims.(jwt.MapClaims)
	claims["sub"] = user.ID
	claims["exp"] = now.Add(config.JwtAccessExpiresIn).Unix()
	claims["iat"] = now.Unix()
	claims["nbf"] = now.Unix()

	return tokenByte.SignedString([]byte(config.JwtAccessSecret))
}

func CreateRefreshToken(user *models.User) (string, error) {
	config, _ := LoadEnv(".")
	tokenByte := jwt.New(jwt.SigningMethodHS256)
	now := time.Now().UTC()
	claims := tokenByte.Claims.(jwt.MapClaims)
	claims["sub"] = user.ID
	claims["exp"] = now.Add(config.JwtRefreshExpiresIn).Unix()
	claims["iat"] = now.Unix()
	claims["nbf"] = now.Unix()

	return tokenByte.SignedString([]byte(config.JwtRefreshSecret))
}
