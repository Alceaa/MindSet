package middlewares

import (
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

type RateLimitRule struct {
	Name        string
	Max         int
	Expiration  time.Duration
	SkipSuccess bool
	KeyByLogin  bool
}

type rateBucket struct {
	count   int
	resetAt time.Time
}

var (
	rateBuckets   = map[string]*rateBucket{}
	rateBucketsMu sync.Mutex
)

func RateLimiter(rule RateLimitRule) fiber.Handler {
	if rule.Max <= 0 || rule.Expiration <= 0 || !utils.Config().RateLimitEnabled {
		return func(c *fiber.Ctx) error { return c.Next() }
	}

	return func(c *fiber.Ctx) error {
		key := rule.Name + "|" + rateKey(c, rule)

		retryAfter, allowed := rateAllow(key, rule.Max, rule.Expiration)
		if !allowed {
			c.Set(fiber.HeaderRetryAfter, strconv.Itoa(int(retryAfter.Seconds())+1))
			return utils.Fail(c, fiber.StatusTooManyRequests, "Слишком много попыток, попробуйте позже", nil)
		}

		if err := c.Next(); err != nil {
			return err
		}

		if rule.SkipSuccess && c.Response().StatusCode() < fiber.StatusBadRequest {
			rateRefund(key)
		}
		return nil
	}
}

func rateKey(c *fiber.Ctx, rule RateLimitRule) string {
	ip := c.IP()
	if !rule.KeyByLogin {
		return ip
	}

	if login := loginFromBody(c); login != "" {
		return ip + "|" + login
	}
	return ip
}

func loginFromBody(c *fiber.Ctx) string {
	body := c.Body()
	if len(body) == 0 {
		return ""
	}

	var payload struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(payload.Login))
}

func rateAllow(key string, max int, expiration time.Duration) (time.Duration, bool) {
	now := time.Now()

	rateBucketsMu.Lock()
	defer rateBucketsMu.Unlock()

	cleanupRateBuckets(now)

	bucket, ok := rateBuckets[key]
	if !ok || now.After(bucket.resetAt) {
		rateBuckets[key] = &rateBucket{count: 1, resetAt: now.Add(expiration)}
		return 0, true
	}

	if bucket.count >= max {
		return time.Until(bucket.resetAt), false
	}

	bucket.count++
	return 0, true
}

func rateRefund(key string) {
	rateBucketsMu.Lock()
	defer rateBucketsMu.Unlock()

	if bucket, ok := rateBuckets[key]; ok && bucket.count > 0 {
		bucket.count--
	}
}

func cleanupRateBuckets(now time.Time) {
	if len(rateBuckets) < 1000 {
		return
	}

	for key, bucket := range rateBuckets {
		if now.After(bucket.resetAt) {
			delete(rateBuckets, key)
		}
	}
}
