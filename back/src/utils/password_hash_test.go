package utils

import (
	"fmt"
	"strings"
	"testing"
)

func TestHashPasswordAndCheck(t *testing.T) {
	cfg := useTestConfig(t)

	const password = "sup3r-secret-password"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	if hash == password {
		t.Fatal("пароль сохранён в открытом виде")
	}
	if !strings.HasPrefix(hash, "$2a$") {
		t.Errorf("неожиданный формат bcrypt-хеша: %q", hash)
	}
	if want := fmt.Sprintf("$2a$%02d$", cfg.BcryptCost); !strings.HasPrefix(hash, want) {
		t.Errorf("хеш %q не содержит ожидаемый cost %d", hash, cfg.BcryptCost)
	}

	if !CheckPasswordHash(password, hash) {
		t.Error("верный пароль не прошёл проверку")
	}
	if CheckPasswordHash("wrong-password", hash) {
		t.Error("неверный пароль прошёл проверку")
	}
}

func TestHashPasswordIsSalted(t *testing.T) {
	useTestConfig(t)

	first, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	second, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	if first == second {
		t.Error("одинаковые пароли дали одинаковый хеш — соль не применяется")
	}
}

func TestCheckPasswordHashWithGarbage(t *testing.T) {
	useTestConfig(t)

	if CheckPasswordHash("password", "not-a-bcrypt-hash") {
		t.Error("мусор вместо хеша был принят как валидный")
	}
}
