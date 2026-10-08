package mailer

import (
	"strings"
	"testing"
	"time"
)

func TestNewTokenIsUniqueAndHashed(t *testing.T) {
	first, firstHash, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	second, secondHash, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}

	if first == "" || len(first) != 64 {
		t.Fatalf("токен должен быть 32 байта в hex, получено %q", first)
	}
	if first == second {
		t.Fatal("два вызова NewToken вернули одинаковый токен")
	}
	if firstHash == secondHash {
		t.Fatal("хэши разных токенов совпали")
	}
	if firstHash != HashToken(first) || secondHash != HashToken(second) {
		t.Fatal("NewToken вернул хэш, не совпадающий с HashToken")
	}
	if len(firstHash) != 64 {
		t.Fatalf("sha256 в hex должен быть 64 символа, получено %d", len(firstHash))
	}
	if strings.Contains(firstHash, first) {
		t.Fatal("хэш содержит токен целиком")
	}
}

func TestSendInLogModeDoesNotFail(t *testing.T) {
	Setup(Config{})
	if Enabled() {
		t.Fatal("без SMTP_HOST/SMTP_FROM отправка должна быть выключена")
	}

	if err := Send("someone@example.com", "Тема", "текст письма"); err != nil {
		t.Fatalf("dev-режим не должен возвращать ошибку: %v", err)
	}
	if err := Send("", "Тема", "текст"); err == nil {
		t.Fatal("пустой адрес получателя должен приводить к ошибке")
	}
}

func TestHumanTTLPluralization(t *testing.T) {
	cases := []struct {
		ttl  time.Duration
		want string
	}{
		{time.Hour, "1 час"},
		{2 * time.Hour, "2 часа"},
		{5 * time.Hour, "5 часов"},
		{24 * time.Hour, "1 день"},
		{48 * time.Hour, "2 дня"},
		{11 * 24 * time.Hour, "11 дней"},
		{30 * time.Minute, "30 минут"},
		{2 * time.Minute, "2 минуты"},
		{time.Minute, "1 минуту"},
	}

	for _, tc := range cases {
		if got := humanTTL(tc.ttl); got != tc.want {
			t.Errorf("humanTTL(%s) = %q, ожидалось %q", tc.ttl, got, tc.want)
		}
	}
}

func TestAddressOnlyAndSubjects(t *testing.T) {
	if got := addressOnly("MindSet <no-reply@mindset.ru>"); got != "no-reply@mindset.ru" {
		t.Errorf("addressOnly с именем = %q", got)
	}
	if got := addressOnly(" just@mail.ru "); got != "just@mail.ru" {
		t.Errorf("addressOnly без имени = %q", got)
	}

	Setup(Config{Host: "smtp.example.com", Port: 587, From: "MindSet <no-reply@mindset.ru>", TLS: "starttls"})
	if !Enabled() {
		t.Fatal("с настроенным SMTP отправка должна быть включена")
	}

	msg := buildMessage("user@example.com", "Сброс пароля", "строка один\nстрока два")
	for _, want := range []string{
		"From: MindSet <no-reply@mindset.ru>\r\n",
		"To: user@example.com\r\n",
		"Content-Type: text/plain; charset=utf-8\r\n",
		"строка один\r\nстрока два\r\n",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("в письме нет %q:\n%s", want, msg)
		}
	}
	if !strings.Contains(msg, "Subject: ") {
		t.Errorf("в письме нет заголовка Subject:\n%s", msg)
	}
}
