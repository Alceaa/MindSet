package notify

import (
	"strings"
	"testing"
	"time"
)

func clearDedup() {
	mu.Lock()
	defer mu.Unlock()

	lastKeys = map[string]time.Time{}
}

func TestSendInDevModeDoesNotFail(t *testing.T) {
	Setup(Config{})

	if Enabled() {
		t.Fatal("без токена и chat_id отправка должна быть выключена")
	}
	if err := Send("тестовое сообщение"); err != nil {
		t.Fatalf("dev-режим не должен возвращать ошибку: %v", err)
	}
	if err := Send("   "); err == nil {
		t.Fatal("пустое сообщение должно приводить к ошибке")
	}
}

func TestSetupEnablesBot(t *testing.T) {
	defer Setup(Config{})

	Setup(Config{Token: "123:abc", ChatID: "-100500"})
	if !Enabled() {
		t.Fatal("с токеном и chat_id отправка должна быть включена")
	}

	Setup(Config{Token: "123:abc"})
	if Enabled() {
		t.Fatal("без chat_id отправка должна быть выключена")
	}
}

func TestAlertDeduplicatesByKey(t *testing.T) {
	Setup(Config{})
	clearDedup()

	if !shouldSend("server-error") {
		t.Fatal("первое сообщение должно проходить")
	}
	if shouldSend("server-error") {
		t.Fatal("повтор в пределах окна должен подавляться")
	}
	if !shouldSend("health") {
		t.Fatal("разные ключи не должны влиять друг на друга")
	}

	mu.Lock()
	lastKeys["server-error"] = time.Now().Add(-2 * alertWindow)
	mu.Unlock()

	if !shouldSend("server-error") {
		t.Fatal("после окна сообщение должно снова проходить")
	}
}

func TestTextsContainKeyFields(t *testing.T) {
	report := BugReportText("octocat", "/settings?tab=bug", "падает сохранение", "шаги: 1, 2, 3")
	for _, want := range []string{"octocat", "/settings?tab=bug", "падает сохранение", "шаги: 1, 2, 3"} {
		if !strings.Contains(report, want) {
			t.Errorf("в отчёте нет %q:\n%s", want, report)
		}
	}

	anonymous := BugReportText("", "", "", "текст")
	if !strings.Contains(anonymous, "аноним") {
		t.Errorf("без автора должно быть «аноним»: %s", anonymous)
	}

	serverError := ServerErrorText("POST", "/sets", 500, "octocat", "boom")
	for _, want := range []string{"500", "POST /sets", "octocat", "boom"} {
		if !strings.Contains(serverError, want) {
			t.Errorf("в алерте об ошибке нет %q:\n%s", want, serverError)
		}
	}

	alert := HealthAlertText("БД недоступна", 2*time.Hour)
	if !strings.Contains(alert, "БД недоступна") || !strings.Contains(alert, "2 часа") {
		t.Errorf("некорректный алерт о падении /health:\n%s", alert)
	}

	recovery := HealthRecoveryText("БД отвечает", 90*time.Minute)
	if !strings.Contains(recovery, "БД отвечает") || !strings.Contains(recovery, "1 час") {
		t.Errorf("некорректное сообщение о восстановлении:\n%s", recovery)
	}

	long := strings.Repeat("x", 1000)
	if size := len([]rune(ServerErrorText("GET", "/x", 500, "", long))); size > 900 {
		t.Errorf("длинные детали должны обрезаться, длина = %d", size)
	}
}
