package monitor

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"mindset/db"
	"mindset/notify"
)

type Status struct {
	OK        bool
	Details   string
	CheckedAt time.Time
}

type Config struct {
	Interval          time.Duration
	HeartbeatURL      string
	HeartbeatInterval time.Duration
}

const heartbeatTimeout = 10 * time.Second

var heartbeatClient = &http.Client{Timeout: heartbeatTimeout}

func Check(ctx context.Context) Status {
	if err := db.Health(ctx); err != nil {
		return Status{OK: false, Details: "БД недоступна: " + err.Error(), CheckedAt: time.Now()}
	}
	return Status{OK: true, Details: "БД отвечает", CheckedAt: time.Now()}
}

func Start(cfg Config) {
	interval := cfg.Interval
	if interval <= 0 {
		interval = 2 * time.Hour
	}

	log.Printf("Монитор /health: проверка каждые %s", interval)
	go alertLoop(interval, time.Now())

	heartbeatURL := strings.TrimSpace(cfg.HeartbeatURL)
	if heartbeatURL == "" {
		return
	}

	heartbeatInterval := cfg.HeartbeatInterval
	if heartbeatInterval <= 0 {
		heartbeatInterval = 5 * time.Minute
	}
	log.Printf("Монитор /health: сигнал внешнему сервису каждые %s", heartbeatInterval)
	go heartbeatLoop(heartbeatURL, heartbeatInterval)
}

func alertLoop(interval time.Duration, started time.Time) {
	failing := false

	check := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		status := Check(ctx)
		cancel()

		switch {
		case status.OK && failing:
			failing = false
			notify.Alert("health", notify.HealthRecoveryText(status.Details, time.Since(started)))
		case !status.OK:
			failing = true
			notify.Alert("health", notify.HealthAlertText(status.Details, time.Since(started)))
		}
	}

	check()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		check()
	}
}

func heartbeatLoop(url string, interval time.Duration) {
	send := func() {
		ctx, cancel := context.WithTimeout(context.Background(), heartbeatTimeout)
		defer cancel()

		status := Check(ctx)
		if err := ping(ctx, url, status); err != nil {
			log.Printf("[monitor] внешний сервис не получил сигнал: %v", err)
		}
	}

	send()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		send()
	}
}

func ping(ctx context.Context, url string, status Status) error {
	target := url
	if !status.OK {
		target = strings.TrimRight(url, "/") + "/fail"
	}

	body := fmt.Sprintf("status=%s checked_at=%s details=%s",
		statusLabel(status.OK), status.CheckedAt.Format(time.RFC3339), status.Details)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader([]byte(body)))
	if err != nil {
		return fmt.Errorf("monitor: запрос сигнала: %w", err)
	}
	request.Header.Set("Content-Type", "text/plain; charset=utf-8")

	response, err := heartbeatClient.Do(request)
	if err != nil {
		return fmt.Errorf("monitor: сигнал: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("monitor: сигнал отклонён: %d", response.StatusCode)
	}
	return nil
}

func statusLabel(ok bool) string {
	if ok {
		return "ok"
	}
	return "fail"
}
