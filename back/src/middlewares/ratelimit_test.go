package middlewares

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("ENV_FILE", filepath.Join("..", ".env"))
	os.Exit(m.Run())
}

func resetRateBuckets() {
	rateBucketsMu.Lock()
	defer rateBucketsMu.Unlock()

	rateBuckets = map[string]*rateBucket{}
}

func expireRateBuckets() {
	rateBucketsMu.Lock()
	defer rateBucketsMu.Unlock()

	for _, bucket := range rateBuckets {
		bucket.resetAt = time.Now().Add(-time.Second)
	}
}

func limitedApp(rule RateLimitRule, status int) *fiber.App {
	app := fiber.New()
	app.Post("/x", RateLimiter(rule), func(c *fiber.Ctx) error {
		return c.SendStatus(status)
	})
	return app
}

func postJSON(t *testing.T, app *fiber.App, body string) *http.Response {
	t.Helper()

	req := httptest.NewRequest(fiber.MethodPost, "/x", strings.NewReader(body))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("запрос: %v", err)
	}
	return resp
}

func TestRateLimiterBlocksAfterMax(t *testing.T) {
	resetRateBuckets()

	app := limitedApp(RateLimitRule{Name: "test-block", Max: 2, Expiration: time.Minute}, fiber.StatusOK)

	for attempt := 1; attempt <= 2; attempt++ {
		if resp := postJSON(t, app, "{}"); resp.StatusCode != fiber.StatusOK {
			t.Fatalf("попытка %d = %d, ожидалось 200", attempt, resp.StatusCode)
		}
	}

	resp := postJSON(t, app, "{}")
	if resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("третья попытка = %d, ожидалось 429", resp.StatusCode)
	}
	if resp.Header.Get(fiber.HeaderRetryAfter) == "" {
		t.Error("в ответе 429 нет заголовка Retry-After")
	}
}

func TestRateLimiterRefundsSuccessfulRequests(t *testing.T) {
	resetRateBuckets()

	app := limitedApp(
		RateLimitRule{Name: "test-refund", Max: 2, Expiration: time.Minute, SkipSuccess: true},
		fiber.StatusOK,
	)

	for attempt := 1; attempt <= 5; attempt++ {
		if resp := postJSON(t, app, "{}"); resp.StatusCode != fiber.StatusOK {
			t.Fatalf("успешная попытка %d = %d, ожидалось 200", attempt, resp.StatusCode)
		}
	}
}

func TestRateLimiterCountsFailedRequests(t *testing.T) {
	resetRateBuckets()

	app := limitedApp(
		RateLimitRule{Name: "test-fail", Max: 2, Expiration: time.Minute, SkipSuccess: true},
		fiber.StatusUnauthorized,
	)

	postJSON(t, app, "{}")
	postJSON(t, app, "{}")

	if resp := postJSON(t, app, "{}"); resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("третья неуспешная попытка = %d, ожидалось 429", resp.StatusCode)
	}
}

func TestRateLimiterSeparatesKeysByLogin(t *testing.T) {
	resetRateBuckets()

	app := limitedApp(
		RateLimitRule{Name: "test-login", Max: 1, Expiration: time.Minute, KeyByLogin: true},
		fiber.StatusOK,
	)

	if resp := postJSON(t, app, `{"login":"alice"}`); resp.StatusCode != fiber.StatusOK {
		t.Fatalf("первый запрос = %d, ожидалось 200", resp.StatusCode)
	}
	if resp := postJSON(t, app, `{"login":"alice"}`); resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("повтор того же логина = %d, ожидалось 429", resp.StatusCode)
	}
	if resp := postJSON(t, app, `{"login":"bob"}`); resp.StatusCode != fiber.StatusOK {
		t.Fatalf("другой логин = %d, ожидалось 200", resp.StatusCode)
	}
}

func TestRateLimiterWindowResets(t *testing.T) {
	resetRateBuckets()

	app := limitedApp(RateLimitRule{Name: "test-window", Max: 1, Expiration: time.Minute}, fiber.StatusOK)

	postJSON(t, app, "{}")
	if resp := postJSON(t, app, "{}"); resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("второй запрос = %d, ожидалось 429", resp.StatusCode)
	}

	expireRateBuckets()

	if resp := postJSON(t, app, "{}"); resp.StatusCode != fiber.StatusOK {
		t.Fatalf("после истечения окна = %d, ожидалось 200", resp.StatusCode)
	}
}
