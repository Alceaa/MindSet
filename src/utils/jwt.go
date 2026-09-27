package utils

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"mindset/models"

	"github.com/golang-jwt/jwt"
)

var (
	ErrInvalidAccessToken  = errors.New("invalid access token")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrUnexpectedTokenType = errors.New("unexpected token type")
)

func CreateAccessToken(user *models.User) (string, error) {
	cfg := Config()
	return createToken(user, models.TokenTypeAccess, cfg.JwtAccessSecret, cfg.JwtAccessExpiresIn)
}

func CreateRefreshToken(user *models.User) (string, error) {
	cfg := Config()
	return createToken(user, models.TokenTypeRefresh, cfg.JwtRefreshSecret, cfg.JwtRefreshExpiresIn)
}

func createToken(user *models.User, tokenType models.TokenType, secret string, expiresIn time.Duration) (string, error) {
	if user == nil || user.ID == 0 {
		return "", errors.New("cannot create token for empty user")
	}
	if secret == "" {
		return "", errors.New("jwt secret is not configured")
	}
	if expiresIn <= 0 {
		return "", errors.New("jwt expiration must be positive")
	}

	now := time.Now().UTC()
	claims := models.TokenClaims{
		TokenType: tokenType,
		StandardClaims: jwt.StandardClaims{
			Subject:   strconv.Itoa(user.ID),
			Issuer:    "mindset",
			IssuedAt:  now.Unix(),
			NotBefore: now.Unix(),
			ExpiresAt: now.Add(expiresIn).Unix(),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func ParseAccessToken(tokenString string) (*models.TokenClaims, error) {
	return parseToken(tokenString, models.TokenTypeAccess, Config().JwtAccessSecret, ErrInvalidAccessToken)
}

func ParseRefreshToken(tokenString string) (*models.TokenClaims, error) {
	return parseToken(tokenString, models.TokenTypeRefresh, Config().JwtRefreshSecret, ErrInvalidRefreshToken)
}

func parseToken(tokenString string, expectedType models.TokenType, secret string, sentinel error) (*models.TokenClaims, error) {
	if tokenString == "" {
		return nil, sentinel
	}
	if secret == "" {
		return nil, errors.New("jwt secret is not configured")
	}

	claims := &models.TokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(parsed *jwt.Token) (interface{}, error) {
		if _, ok := parsed.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", parsed.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", sentinel, err)
	}
	if !token.Valid {
		return nil, sentinel
	}
	if claims.TokenType != expectedType {
		return nil, ErrUnexpectedTokenType
	}
	if claims.Subject == "" {
		return nil, sentinel
	}
	return claims, nil
}

func TokenMaxAges() (accessMaxAge, refreshMaxAge int) {
	cfg := Config()
	return int(cfg.JwtAccessExpiresIn.Seconds()), int(cfg.JwtRefreshExpiresIn.Seconds())
}
