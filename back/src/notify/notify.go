package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Token  string
	ChatID string
}

const (
	apiBase     = "https://api.telegram.org"
	alertWindow = 5 * time.Minute
	requestTTL  = 10 * time.Second
)

var (
	current  Config
	mu       sync.Mutex
	lastKeys = map[string]time.Time{}
	client   = &http.Client{Timeout: requestTTL}
)

func Setup(cfg Config) {
	current = Config{
		Token:  strings.TrimSpace(cfg.Token),
		ChatID: strings.TrimSpace(cfg.ChatID),
	}

	if !Enabled() {
		log.Println("Уведомления: Telegram не настроен — сообщения печатаются в лог (dev-режим)")
		return
	}
	log.Println("Уведомления: Telegram подключён")
}

func Enabled() bool {
	return current.Token != "" && current.ChatID != ""
}

func Send(text string) error {
	if strings.TrimSpace(text) == "" {
		return fmt.Errorf("notify: пустое сообщение")
	}

	if !Enabled() {
		log.Printf("TELEGRAM (dev-режим, бот не настроен)\n%s", indent(text))
		return nil
	}

	payload, err := json.Marshal(map[string]string{
		"chat_id": current.ChatID,
		"text":    text,
	})
	if err != nil {
		return fmt.Errorf("notify: сериализация сообщения: %w", err)
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", apiBase, current.Token)
	response, err := client.Post(endpoint, "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("notify: отправка: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 512))
		return fmt.Errorf("notify: telegram ответил %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func Alert(key, text string) {
	if !shouldSend(key) {
		return
	}
	if err := Send(text); err != nil {
		log.Printf("[notify] %v", err)
	}
}

func shouldSend(key string) bool {
	now := time.Now()

	mu.Lock()
	defer mu.Unlock()

	if sentAt, ok := lastKeys[key]; ok && now.Sub(sentAt) < alertWindow {
		return false
	}
	lastKeys[key] = now

	if len(lastKeys) > 500 {
		for item, sentAt := range lastKeys {
			if now.Sub(sentAt) > 2*alertWindow {
				delete(lastKeys, item)
			}
		}
	}
	return true
}

func indent(text string) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	for i, line := range lines {
		lines[i] = "  | " + line
	}
	return strings.Join(lines, "\n")
}
