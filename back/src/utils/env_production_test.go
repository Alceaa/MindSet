package utils

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeEnv(t *testing.T, lines []string) string {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o600); err != nil {
		t.Fatalf("write env: %v", err)
	}
	t.Setenv("ENV_FILE", path)

	return dir
}

func TestProductionRejectsPlaceholderSecrets(t *testing.T) {
	dir := writeEnv(t, []string{
		"ENV=production",
		"DATABASE_URL=postgres://mindset:strong-password-123@db:5432/mindset",
		"JWT_ACCESS_SECRET=change-me-access",
		"JWT_REFRESH_SECRET=1d5b1b2e4ee84cb6a9a3e4f4b8f2c1d0a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2",
	})

	_, err := LoadEnv(dir)
	if err == nil {
		t.Fatal("ожидалась ошибка про заглушку в секретах")
	}
	if !strings.Contains(err.Error(), "заглушку") {
		t.Fatalf("неожиданная ошибка: %v", err)
	}
}

func TestProductionRejectsShortSecrets(t *testing.T) {
	dir := writeEnv(t, []string{
		"ENV=production",
		"DATABASE_URL=postgres://mindset:strong-password-123@db:5432/mindset",
		"JWT_ACCESS_SECRET=short-secret",
		"JWT_REFRESH_SECRET=1d5b1b2e4ee84cb6a9a3e4f4b8f2c1d0a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2",
	})

	if _, err := LoadEnv(dir); err == nil || !strings.Contains(err.Error(), "короткий") {
		t.Fatalf("ожидалась ошибка про длину секрета, получено: %v", err)
	}
}

func TestProductionAcceptsStrongSecrets(t *testing.T) {
	dir := writeEnv(t, []string{
		"ENV=production",
		"DATABASE_URL=postgres://mindset:strong-password-123@db:5432/mindset",
		"JWT_ACCESS_SECRET=1d5b1b2e4ee84cb6a9a3e4f4b8f2c1d0a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2",
		"JWT_REFRESH_SECRET=9f8e7d6c5b4a39281706f5e4d3c2b1a0998877665544332211ffeeddccbbaa99",
		"ADMIN_TOKEN=3f1c2b4a5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708",
	})

	cfg, err := LoadEnv(dir)
	if err != nil {
		t.Fatalf("корректные секреты должны приниматься: %v", err)
	}
	if !cfg.IsProduction() || cfg.AdminToken == "" {
		t.Fatalf("конфиг прочитан неверно: %+v", cfg)
	}
}
