package utils

import (
	"testing"
	"time"
)

func useTestConfig(t *testing.T) Env {
	t.Helper()

	cfg := Env{
		Env:                 envDevelopment,
		Port:                "8080",
		DBUrl:               "postgres://test:test@127.0.0.1:5432/test",
		JwtAccessSecret:     "test-access-secret",
		JwtRefreshSecret:    "test-refresh-secret",
		JwtAccessExpiresIn:  15 * time.Minute,
		JwtRefreshExpiresIn: 7 * 24 * time.Hour,
		BcryptCost:          10,
	}
	cfg.applyDefaults()
	configOnce.Do(func() {})

	previous := config
	config = cfg
	t.Cleanup(func() { config = previous })

	return cfg
}

func TestLoadEnvFromFile(t *testing.T) {
	cfg, err := LoadEnv("..")
	if err != nil {
		t.Fatalf("LoadEnv вернул ошибку: %v", err)
	}

	if cfg.Env != envDevelopment {
		t.Errorf("Env = %q, ожидалось %q", cfg.Env, envDevelopment)
	}
	if cfg.DBUrl == "" {
		t.Error("DBUrl пустой")
	}
	if cfg.JwtAccessSecret == "" || cfg.JwtRefreshSecret == "" {
		t.Error("JWT-секреты не загружены")
	}
}

func TestTokenLifetimeIsNotZero(t *testing.T) {
	cfg, err := LoadEnv("..")
	if err != nil {
		t.Fatalf("LoadEnv вернул ошибку: %v", err)
	}

	if cfg.JwtAccessExpiresIn <= 0 {
		t.Errorf("JwtAccessExpiresIn = %v, ожидалось положительное значение", cfg.JwtAccessExpiresIn)
	}
	if cfg.JwtRefreshExpiresIn <= 0 {
		t.Errorf("JwtRefreshExpiresIn = %v, ожидалось положительное значение", cfg.JwtRefreshExpiresIn)
	}
	if cfg.JwtRefreshExpiresIn <= cfg.JwtAccessExpiresIn {
		t.Error("время жизни refresh-токена должно быть больше, чем у access-токена")
	}
}

func TestLoadEnvWithoutFileReturnsError(t *testing.T) {
	t.Setenv("ENV_FILE", t.TempDir()+"/missing.env")
	t.Setenv("JWT_ACCESS_SECRET", "")
	t.Setenv("JWT_REFRESH_SECRET", "")
	t.Setenv("DATABASE_URL", "")

	if _, err := LoadEnv(t.TempDir()); err == nil {
		t.Fatal("ожидалась ошибка про отсутствующие обязательные параметры")
	}
}

func TestCookieFlagsPerEnvironment(t *testing.T) {
	dev := Env{Env: envDevelopment}
	if got, want := dev.SameSite(), "Lax"; got != want {
		t.Errorf("dev SameSite = %q, ожидалось %q", got, want)
	}
	if dev.SecureCookie() {
		t.Error("в development cookie не должна быть Secure")
	}

	prod := Env{Env: envProduction}
	if got, want := prod.SameSite(), "None"; got != want {
		t.Errorf("prod SameSite = %q, ожидалось %q", got, want)
	}
	if !prod.SecureCookie() {
		t.Error("в production с SameSite=None cookie обязана быть Secure")
	}
}

func TestAddress(t *testing.T) {
	cases := map[string]string{
		"":      ":8080",
		"9090":  ":9090",
		":7070": ":7070",
	}
	for port, want := range cases {
		if got := (Env{Port: port}).Address(); got != want {
			t.Errorf("Address(%q) = %q, ожидалось %q", port, got, want)
		}
	}
}

func TestBcryptCostIsClampedToSafeRange(t *testing.T) {
	low := Env{BcryptCost: 1}
	low.applyDefaults()
	if low.BcryptCost != 12 {
		t.Errorf("слишком низкий cost не был исправлен: %d", low.BcryptCost)
	}

	high := Env{BcryptCost: 40}
	high.applyDefaults()
	if high.BcryptCost != 12 {
		t.Errorf("слишком высокий cost не был исправлен: %d", high.BcryptCost)
	}
}
