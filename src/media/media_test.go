package media

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"
)

func resetStore() { instance = nil }

func TestSetupWithoutCredentialsIsDisabled(t *testing.T) {
	resetStore()
	t.Cleanup(resetStore)

	if err := Setup(Config{Endpoint: "https://s3.twcstorage.ru", Bucket: "b"}); err != ErrNotConfigured {
		t.Fatalf("без ключей ожидался ErrNotConfigured, получили %v", err)
	}
	if Enabled() {
		t.Error("хранилище не должно быть включено без ключей")
	}
}

func TestSetupRequiresEndpoint(t *testing.T) {
	resetStore()
	t.Cleanup(resetStore)

	if err := Setup(Config{AccessKey: "a", SecretKey: "s", Bucket: "b"}); err != ErrNotConfigured {
		t.Fatalf("без endpoint ожидался ErrNotConfigured, получили %v", err)
	}
}

func TestPresignPutWithoutSetup(t *testing.T) {
	resetStore()
	t.Cleanup(resetStore)

	if _, err := PresignPut(context.Background(), "k", time.Minute); err != ErrNotConfigured {
		t.Fatalf("без Setup ожидался ErrNotConfigured, получили %v", err)
	}
}

func TestPresignPutTimewebShape(t *testing.T) {
	resetStore()
	t.Cleanup(resetStore)

	err := Setup(Config{
		Endpoint:   "https://s3.twcstorage.ru",
		Region:     "ru-1",
		AccessKey:  "test-access-key",
		SecretKey:  "test-secret-key",
		Bucket:     "mindset-media",
		PublicBase: "https://s3.twcstorage.ru/mindset-media/",
	})
	if err != nil {
		t.Fatalf("Setup вернул ошибку: %v", err)
	}

	raw, err := PresignPut(context.Background(), "sets/7/uuid.png", 10*time.Minute)
	if err != nil {
		t.Fatalf("PresignPut вернул ошибку: %v", err)
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("некорректный URL %q: %v", raw, err)
	}
	if parsed.Scheme != "https" {
		t.Errorf("scheme = %q, ожидался https", parsed.Scheme)
	}
	if parsed.Host != "s3.twcstorage.ru" {
		t.Errorf("host = %q, ожидался s3.twcstorage.ru", parsed.Host)
	}
	if parsed.Path != "/mindset-media/sets/7/uuid.png" {
		t.Errorf("path = %q, ожидался path-style /mindset-media/sets/7/uuid.png", parsed.Path)
	}

	q := parsed.Query()
	if got := q.Get("X-Amz-Algorithm"); got != "AWS4-HMAC-SHA256" {
		t.Errorf("X-Amz-Algorithm = %q, ожидался AWS4-HMAC-SHA256", got)
	}
	if got := q.Get("X-Amz-Expires"); got != "600" {
		t.Errorf("X-Amz-Expires = %q, ожидался 600", got)
	}
	scope := q.Get("X-Amz-Credential")
	if !strings.HasPrefix(scope, "test-access-key/") || !strings.Contains(scope, "/ru-1/s3/aws4_request") {
		t.Errorf("X-Amz-Credential = %q, ожидался регион ru-1", scope)
	}

	signed := strings.ToLower(q.Get("X-Amz-SignedHeaders"))
	if !strings.Contains(signed, "host") {
		t.Errorf("X-Amz-SignedHeaders = %q, ожидался host", signed)
	}
	if strings.Contains(signed, "content-type") {
		t.Errorf("Content-Type не должен входить в подпись (Timeweb): %q", signed)
	}

	if got, want := PublicURL("sets/7/uuid.png"), "https://s3.twcstorage.ru/mindset-media/sets/7/uuid.png"; got != want {
		t.Errorf("PublicURL = %q, ожидался %q", got, want)
	}
}
