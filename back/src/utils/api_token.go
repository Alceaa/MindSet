package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

const (
	APITokenPrefix     = "msk_"
	apiTokenSecretSize = 32
	apiTokenLabelSize  = 6
)

func NewAPIToken() (string, error) {
	secret := make([]byte, apiTokenSecretSize)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return APITokenPrefix + base64.RawURLEncoding.EncodeToString(secret), nil
}

func HashAPIToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func APITokenLabel(token string) string {
	body := strings.TrimPrefix(strings.TrimSpace(token), APITokenPrefix)
	if len(body) > apiTokenLabelSize {
		body = body[:apiTokenLabelSize]
	}
	return APITokenPrefix + body
}

func IsAPIToken(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, APITokenPrefix) && len(trimmed) > len(APITokenPrefix)+apiTokenLabelSize
}
