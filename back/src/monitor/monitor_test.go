package monitor

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mindset/db"
	"mindset/utils"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("ENV_FILE", filepath.Join("..", ".env"))
	os.Exit(m.Run())
}

func TestCheckReportsDatabaseState(t *testing.T) {
	cfg := utils.Config()
	if err := db.Open(cfg.DBUrl); err != nil {
		t.Skipf("БД недоступна (%v), тест пропущен", err)
	}
	defer db.Close()

	status := Check(context.Background())
	if !status.OK {
		t.Fatalf("БД доступна, но проверка вернула ошибку: %s", status.Details)
	}
	if !strings.Contains(status.Details, "БД") {
		t.Errorf("неожиданные детали проверки: %s", status.Details)
	}
	if status.CheckedAt.IsZero() {
		t.Error("в статусе нет времени проверки")
	}
}

func TestPingReportsStatusToHeartbeatService(t *testing.T) {
	var paths []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	if err := ping(context.Background(), server.URL, Status{OK: true, Details: "БД отвечает", CheckedAt: time.Now()}); err != nil {
		t.Fatalf("сигнал об успехе: %v", err)
	}
	if err := ping(context.Background(), server.URL, Status{OK: false, Details: "БД недоступна", CheckedAt: time.Now()}); err != nil {
		t.Fatalf("сигнал о сбое: %v", err)
	}

	if len(paths) != 2 {
		t.Fatalf("внешний сервис получил %d запросов, ожидалось 2", len(paths))
	}
	if paths[1] != "/fail" {
		t.Fatalf("о сбое нужно сообщать на /fail, получено %q", paths[1])
	}
}

func TestPingReportsServiceErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	if err := ping(context.Background(), server.URL, Status{OK: true, CheckedAt: time.Now()}); err == nil {
		t.Fatal("ожидалась ошибка при отказе внешнего сервиса")
	}
}
