package utils

import (
	"errors"
	"testing"
	"time"

	"mindset/models"

	"github.com/golang-jwt/jwt"
)

func testUser() *models.User {
	return &models.User{ID: 42, Login: "octocat", Email: "octo@example.com"}
}

func TestCreateAndParseAccessToken(t *testing.T) {
	cfg := useTestConfig(t)
	user := testUser()

	token, err := CreateAccessToken(user)
	if err != nil {
		t.Fatalf("CreateAccessToken: %v", err)
	}

	claims, err := ParseAccessToken(token)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}

	if claims.Subject != "42" {
		t.Errorf("Subject = %q, ожидалось \"42\"", claims.Subject)
	}
	if claims.TokenType != models.TokenTypeAccess {
		t.Errorf("TokenType = %q, ожидалось %q", claims.TokenType, models.TokenTypeAccess)
	}
	if claims.Issuer != "mindset" {
		t.Errorf("Issuer = %q, ожидалось \"mindset\"", claims.Issuer)
	}

	if claims.ExpiresAt <= time.Now().Unix() {
		t.Fatalf("exp = %d, токен просрочен сразу после создания", claims.ExpiresAt)
	}
	expectedExp := time.Now().Add(cfg.JwtAccessExpiresIn).Unix()
	if diff := expectedExp - claims.ExpiresAt; diff < -5 || diff > 5 {
		t.Errorf("exp=%d отличается от ожидаемого времени жизни %v", claims.ExpiresAt, cfg.JwtAccessExpiresIn)
	}
}

func TestRefreshTokenCannotBeUsedAsAccessToken(t *testing.T) {
	useTestConfig(t)

	refreshToken, err := CreateRefreshToken(testUser())
	if err != nil {
		t.Fatalf("CreateRefreshToken: %v", err)
	}

	if _, err := ParseAccessToken(refreshToken); err == nil {
		t.Fatal("refresh-токен был принят как access-токен")
	}

	claims, err := ParseRefreshToken(refreshToken)
	if err != nil {
		t.Fatalf("ParseRefreshToken: %v", err)
	}
	if claims.TokenType != models.TokenTypeRefresh {
		t.Errorf("TokenType = %q, ожидалось %q", claims.TokenType, models.TokenTypeRefresh)
	}
}

func TestParseTokenRejectsInvalidInput(t *testing.T) {
	useTestConfig(t)

	cases := map[string]string{
		"пустая строка":      "",
		"мусор":              "not-a-token",
		"подпись не из трёх": "a.b",
	}

	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseAccessToken(token); err == nil {
				t.Fatalf("токен %q был принят", token)
			}
			if _, err := ParseAccessToken(token); !errors.Is(err, ErrInvalidAccessToken) {
				t.Errorf("ожидалась ErrInvalidAccessToken, получено %v", err)
			}
		})
	}
}

func TestParseTokenRejectsForeignSignature(t *testing.T) {
	useTestConfig(t)

	foreign := jwt.NewWithClaims(jwt.SigningMethodHS256, models.TokenClaims{
		TokenType: models.TokenTypeAccess,
		StandardClaims: jwt.StandardClaims{
			Subject:   "42",
			ExpiresAt: time.Now().Add(time.Hour).Unix(),
		},
	})
	signed, err := foreign.SignedString([]byte("another-secret"))
	if err != nil {
		t.Fatalf("SignedString: %v", err)
	}

	if _, err := ParseAccessToken(signed); err == nil {
		t.Fatal("токен, подписанный чужим секретом, был принят")
	}
}

func TestParseTokenRejectsExpiredToken(t *testing.T) {
	useTestConfig(t)

	expired := jwt.NewWithClaims(jwt.SigningMethodHS256, models.TokenClaims{
		TokenType: models.TokenTypeAccess,
		StandardClaims: jwt.StandardClaims{
			Subject:   "42",
			IssuedAt:  time.Now().Add(-2 * time.Hour).Unix(),
			NotBefore: time.Now().Add(-2 * time.Hour).Unix(),
			ExpiresAt: time.Now().Add(-time.Hour).Unix(),
		},
	})
	signed, err := expired.SignedString([]byte(Config().JwtAccessSecret))
	if err != nil {
		t.Fatalf("SignedString: %v", err)
	}

	if _, err := ParseAccessToken(signed); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("просроченный токен не был отклонён, ошибка: %v", err)
	}
}

func TestCreateTokenRequiresUserID(t *testing.T) {
	useTestConfig(t)

	if _, err := CreateAccessToken(nil); err == nil {
		t.Error("ожидалась ошибка для nil-пользователя")
	}
	if _, err := CreateAccessToken(&models.User{Login: "no-id"}); err == nil {
		t.Error("ожидалась ошибка для пользователя без ID")
	}
}

func TestTokenMaxAges(t *testing.T) {
	cfg := useTestConfig(t)

	access, refresh := TokenMaxAges()
	if want := int(cfg.JwtAccessExpiresIn.Seconds()); access != want {
		t.Errorf("access maxAge = %d, ожидалось %d", access, want)
	}
	if want := int(cfg.JwtRefreshExpiresIn.Seconds()); refresh != want {
		t.Errorf("refresh maxAge = %d, ожидалось %d", refresh, want)
	}
}
