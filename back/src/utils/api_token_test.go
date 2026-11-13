package utils

import (
	"strings"
	"testing"
)

func TestNewAPITokenShape(t *testing.T) {
	token, err := NewAPIToken()
	if err != nil {
		t.Fatalf("NewAPIToken: %v", err)
	}

	if !strings.HasPrefix(token, APITokenPrefix) {
		t.Errorf("токен %q без префикса %q", token, APITokenPrefix)
	}
	if want := len(APITokenPrefix) + 43; len(token) != want {
		t.Errorf("длина токена %d, ожидалось %d", len(token), want)
	}
	if !IsAPIToken(token) {
		t.Errorf("токен %q не распознан как токен интеграции", token)
	}
	if got, want := APITokenLabel(token), token[:len(APITokenPrefix)+apiTokenLabelSize]; got != want {
		t.Errorf("подпись %q, ожидалось %q", got, want)
	}
}

func TestNewAPITokenIsUnique(t *testing.T) {
	seen := make(map[string]bool, 200)

	for i := 0; i < 200; i++ {
		token, err := NewAPIToken()
		if err != nil {
			t.Fatalf("NewAPIToken: %v", err)
		}

		hash := HashAPIToken(token)
		if seen[hash] {
			t.Fatalf("хеш повторился на %d-м токене", i)
		}
		seen[hash] = true
	}
}

func TestHashAPITokenDoesNotKeepSecret(t *testing.T) {
	const secret = "msk_секретная-часть"

	hash := HashAPIToken(secret)
	if len(hash) != 64 {
		t.Errorf("длина хеша %d, ожидалось 64", len(hash))
	}
	if strings.Contains(hash, "секретная") {
		t.Error("в хеше остался фрагмент секрета")
	}
	if hash != HashAPIToken(secret) {
		t.Error("хеш одного и того же токена отличается")
	}
	if hash == HashAPIToken(secret+"x") {
		t.Error("разные токены дали одинаковый хеш")
	}
}

func TestIsAPITokenAndLabelEdges(t *testing.T) {
	cases := []struct {
		value string
		want  bool
	}{
		{"", false},
		{"Bearer msk_abcdef", false},
		{"msk_abc", false},
		{"msk_abcdefghij", true},
		{"eyJhbGciOiJIUzI1NiJ9.payload.signature", false},
	}

	for _, item := range cases {
		if got := IsAPIToken(item.value); got != item.want {
			t.Errorf("IsAPIToken(%q) = %v, ожидалось %v", item.value, got, item.want)
		}
	}

	if got := APITokenLabel("msk_abc"); got != "msk_abc" {
		t.Errorf("короткий токен подписан как %q", got)
	}
	if got := APITokenLabel("msk_abcdefghij"); got != "msk_abcdef" {
		t.Errorf("подпись длинного токена %q, ожидалось %q", got, "msk_abcdef")
	}
}
