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
	dir := writeEnv(t, []string{
		"ENV=development",
		"DATABASE_URL=postgres://test:test@127.0.0.1:5432/test",
		"JWT_ACCESS_SECRET=test-access-secret",
		"JWT_REFRESH_SECRET=test-refresh-secret",
		"JWT_ACCESS_EXPIRES_IN=15m",
		"JWT_REFRESH_EXPIRES_IN=168h",
	})

	cfg, err := LoadEnv(dir)
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
	dir := writeEnv(t, []string{
		"ENV=development",
		"DATABASE_URL=postgres://test:test@127.0.0.1:5432/test",
		"JWT_ACCESS_SECRET=test-access-secret",
		"JWT_REFRESH_SECRET=test-refresh-secret",
		"JWT_ACCESS_EXPIRES_IN=15m",
		"JWT_REFRESH_EXPIRES_IN=168h",
	})

	cfg, err := LoadEnv(dir)
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
	isolateConfigEnv(t)

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

func TestS3EnvBindingAndLegacyR2Alias(t *testing.T) {
	isolateConfigEnv(t)

	for _, kv := range []struct{ k, v string }{
		{"ENV_FILE", t.TempDir() + "/missing.env"},
		{"JWT_ACCESS_SECRET", "access"},
		{"JWT_REFRESH_SECRET", "refresh"},
		{"DATABASE_URL", "postgres://u:p@127.0.0.1:5432/d"},
	} {
		t.Setenv(kv.k, kv.v)
	}

	t.Run("новые имена S3_*", func(t *testing.T) {
		t.Setenv("S3_ENDPOINT", "https://s3.twcstorage.ru")
		t.Setenv("S3_REGION", "ru-1")
		t.Setenv("S3_BUCKET", "mindset-media")
		t.Setenv("S3_PUBLIC_BASE_URL", "https://s3.twcstorage.ru/mindset-media")

		cfg, err := LoadEnv(t.TempDir())
		if err != nil {
			t.Fatalf("LoadEnv вернул ошибку: %v", err)
		}
		if cfg.S3Endpoint != "https://s3.twcstorage.ru" {
			t.Errorf("S3Endpoint = %q", cfg.S3Endpoint)
		}
		if cfg.S3Region != "ru-1" {
			t.Errorf("S3Region = %q", cfg.S3Region)
		}
		if cfg.S3Bucket != "mindset-media" {
			t.Errorf("S3Bucket = %q", cfg.S3Bucket)
		}
	})

	t.Run("старые имена R2_* как алиасы", func(t *testing.T) {
		t.Setenv("R2_ENDPOINT", "https://acct.r2.cloudflarestorage.com")
		t.Setenv("R2_BUCKET", "old-bucket")

		cfg, err := LoadEnv(t.TempDir())
		if err != nil {
			t.Fatalf("LoadEnv вернул ошибку: %v", err)
		}
		if cfg.S3Endpoint != "https://acct.r2.cloudflarestorage.com" {
			t.Errorf("R2_ENDPOINT не подхватился как алиас: %q", cfg.S3Endpoint)
		}
		if cfg.S3Bucket != "old-bucket" {
			t.Errorf("R2_BUCKET не подхватился как алиас: %q", cfg.S3Bucket)
		}
	})

	t.Run("регион по умолчанию ru-1", func(t *testing.T) {
		cfg, err := LoadEnv(t.TempDir())
		if err != nil {
			t.Fatalf("LoadEnv вернул ошибку: %v", err)
		}
		if cfg.S3Region != "ru-1" {
			t.Errorf("S3Region = %q, ожидался ru-1 по умолчанию", cfg.S3Region)
		}
	})
}
