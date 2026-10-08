package models

import "github.com/golang-jwt/jwt"

type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

type TokenClaims struct {
	TokenType TokenType `json:"type"`
	Epoch     int       `json:"epoch"`
	jwt.StandardClaims
}
