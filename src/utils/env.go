package utils

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/spf13/viper"
)

type Env struct {
	Env  string `mapstructure:"ENV"`
	Port string `mapstructure:"PORT"`

	DBUsername string `mapstructure:"DATABASE_USERNAME"`
	DBName     string `mapstructure:"DATABASE_NAME"`
	DBPassword string `mapstructure:"DATABASE_PASSWORD"`
	DBUrl      string `mapstructure:"DATABASE_URL"`

	JwtAccessSecret     string        `mapstructure:"JWT_ACCESS_SECRET"`
	JwtRefreshSecret    string        `mapstructure:"JWT_REFRESH_SECRET"`
	JwtAccessExpiresIn  time.Duration `mapstructure:"JWT_ACCESS_EXPIRES_IN"`
	JwtRefreshExpiresIn time.Duration `mapstructure:"JWT_REFRESH_EXPIRES_IN"`

	CookieDomain   string `mapstructure:"COOKIE_DOMAIN"`
	CookieSecure   bool   `mapstructure:"COOKIE_SECURE"`
	CookieSameSite string `mapstructure:"COOKIE_SAME_SITE"`

	AllowedOrigins string `mapstructure:"ALLOWED_ORIGINS"`

	BcryptCost int `mapstructure:"BCRYPT_COST"`

	S3Endpoint      string `mapstructure:"S3_ENDPOINT"`
	S3Region        string `mapstructure:"S3_REGION"`
	S3AccessKeyID   string `mapstructure:"S3_ACCESS_KEY_ID"`
	S3SecretKey     string `mapstructure:"S3_SECRET_ACCESS_KEY"`
	S3Bucket        string `mapstructure:"S3_BUCKET"`
	S3PublicBaseURL string `mapstructure:"S3_PUBLIC_BASE_URL"`

	AppBaseURL               string `mapstructure:"APP_BASE_URL"`
	RequireEmailVerification bool   `mapstructure:"REQUIRE_EMAIL_VERIFICATION"`

	SMTPHost     string `mapstructure:"SMTP_HOST"`
	SMTPPort     int    `mapstructure:"SMTP_PORT"`
	SMTPUser     string `mapstructure:"SMTP_USER"`
	SMTPPassword string `mapstructure:"SMTP_PASSWORD"`
	SMTPFrom     string `mapstructure:"SMTP_FROM"`
	SMTPTLS      string `mapstructure:"SMTP_TLS"`

	TelegramBotToken    string        `mapstructure:"TELEGRAM_BOT_TOKEN"`
	TelegramChatID      string        `mapstructure:"TELEGRAM_CHAT_ID"`
	HealthCheckInterval time.Duration `mapstructure:"HEALTH_CHECK_INTERVAL"`
	HeartbeatURL        string        `mapstructure:"HEARTBEAT_URL"`
	HeartbeatInterval   time.Duration `mapstructure:"HEARTBEAT_INTERVAL"`

	RateLimitEnabled         bool `mapstructure:"RATE_LIMIT_ENABLED"`
	RateLimitGlobalPerMinute int  `mapstructure:"RATE_LIMIT_GLOBAL_PER_MINUTE"`
	RateLimitAuthPer15Min    int  `mapstructure:"RATE_LIMIT_AUTH_PER_15MIN"`
	RateLimitEmailPerHour    int  `mapstructure:"RATE_LIMIT_EMAIL_PER_HOUR"`
	RateLimitReportPerHour   int  `mapstructure:"RATE_LIMIT_REPORT_PER_HOUR"`

	TrustProxyHeader string `mapstructure:"TRUST_PROXY_HEADER"`

	AdminToken             string `mapstructure:"ADMIN_TOKEN"`
	RegistrationInviteOnly bool   `mapstructure:"REGISTRATION_INVITE_ONLY"`
	InviteTTLDays          int    `mapstructure:"INVITE_TTL_DAYS"`
}

const (
	envDevelopment = "development"
	envProduction  = "production"
)

var (
	configOnce sync.Once
	config     Env
	configErr  error
)

func LoadEnv(dir string) (Env, error) {
	v := viper.New()
	v.SetConfigType("env")

	if path := findEnvFile(dir); path != "" {
		v.SetConfigFile(path)
	} else {
		v.SetConfigName(".env")
		v.AddConfigPath(dir)
	}

	setDefaults(v)
	bindEnvs(v)
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		var notFound viper.ConfigFileNotFoundError
		if !errors.As(err, &notFound) {
			if _, ok := err.(*os.PathError); !ok {
				return Env{}, fmt.Errorf("read config: %w", err)
			}
		}
	}

	var cfg Env
	if err := v.Unmarshal(&cfg); err != nil {
		return Env{}, fmt.Errorf("unmarshal config: %w", err)
	}

	cfg.applyDefaults()
	if err := cfg.validate(); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func Config() Env {
	configOnce.Do(func() {
		config, configErr = LoadEnv(".")
		if configErr != nil {
			log.Printf("[config] %v", configErr)
		}
	})
	return config
}

func ConfigErr() error { return configErr }

func (e Env) IsProduction() bool {
	return strings.EqualFold(e.Env, envProduction)
}

func (e Env) Origins() []string {
	parts := strings.Split(e.AllowedOrigins, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}

func (e Env) Address() string {
	port := strings.TrimSpace(e.Port)
	if port == "" {
		port = "8080"
	}
	if strings.HasPrefix(port, ":") {
		return port
	}
	return ":" + port
}

func (e Env) SameSite() string {
	if v := strings.TrimSpace(e.CookieSameSite); v != "" {
		return v
	}
	if e.IsProduction() {
		return "None"
	}
	return "Lax"
}

func (e Env) BaseURL() string {
	if base := strings.TrimRight(strings.TrimSpace(e.AppBaseURL), "/"); base != "" {
		return base
	}
	if origins := e.Origins(); len(origins) > 0 {
		return strings.TrimRight(origins[0], "/")
	}
	return "http://localhost:3000"
}

func (e Env) SecureCookie() bool {
	if strings.EqualFold(e.SameSite(), "None") {
		return true
	}
	return e.CookieSecure
}

func (e *Env) applyDefaults() {
	if strings.TrimSpace(e.Env) == "" {
		e.Env = envDevelopment
	}
	if strings.TrimSpace(e.Port) == "" {
		e.Port = "8080"
	}
	if e.JwtAccessExpiresIn <= 0 {
		e.JwtAccessExpiresIn = 15 * time.Minute
	}
	if e.JwtRefreshExpiresIn <= 0 {
		e.JwtRefreshExpiresIn = 7 * 24 * time.Hour
	}
	if e.BcryptCost < 10 || e.BcryptCost > 15 {
		e.BcryptCost = 12
	}
	if strings.TrimSpace(e.SMTPTLS) == "" {
		e.SMTPTLS = "starttls"
	}
}

func (e Env) validate() error {
	var missing []string
	if strings.TrimSpace(e.DBUrl) == "" {
		if strings.TrimSpace(e.DBUsername) == "" || strings.TrimSpace(e.DBName) == "" {
			missing = append(missing, "DATABASE_URL (или DATABASE_USERNAME + DATABASE_NAME)")
		}
	}
	if strings.TrimSpace(e.JwtAccessSecret) == "" {
		missing = append(missing, "JWT_ACCESS_SECRET")
	}
	if strings.TrimSpace(e.JwtRefreshSecret) == "" {
		missing = append(missing, "JWT_REFRESH_SECRET")
	}
	if e.JwtAccessSecret != "" && e.JwtAccessSecret == e.JwtRefreshSecret {
		return errors.New("JWT_ACCESS_SECRET и JWT_REFRESH_SECRET должны различаться")
	}
	if len(missing) > 0 {
		return fmt.Errorf("в .env не заданы обязательные параметры: %s", strings.Join(missing, ", "))
	}
	if e.IsProduction() {
		return e.validateProductionSecrets()
	}
	return nil
}

func (e Env) validateProductionSecrets() error {
	checks := []struct {
		name     string
		value    string
		required bool
	}{
		{"JWT_ACCESS_SECRET", e.JwtAccessSecret, true},
		{"JWT_REFRESH_SECRET", e.JwtRefreshSecret, true},
		{"ADMIN_TOKEN", e.AdminToken, false},
	}

	for _, check := range checks {
		value := strings.TrimSpace(check.value)
		if value == "" {
			if check.required {
				return fmt.Errorf("%s не задан", check.name)
			}
			continue
		}
		if isPlaceholder(value) {
			return fmt.Errorf("%s всё ещё содержит значение-заглушку из шаблона .env", check.name)
		}
		if len(value) < 24 {
			return fmt.Errorf("%s слишком короткий: нужно не меньше 24 символов", check.name)
		}
	}

	password := strings.TrimSpace(e.DBPassword)
	if password != "" {
		if isPlaceholder(password) {
			return errors.New("DATABASE_PASSWORD всё ещё содержит пароль-заглушку из шаблона .env")
		}
		if len(password) < 12 {
			return errors.New("DATABASE_PASSWORD слишком короткий: нужно не меньше 12 символов")
		}
	} else if isPlaceholder(e.DBUrl) {
		return errors.New("DATABASE_URL содержит пароль-заглушку из шаблона .env")
	}

	if isPlaceholder(e.JwtAccessSecret) == false && e.JwtAccessSecret == e.JwtRefreshSecret {
		return errors.New("JWT_ACCESS_SECRET и JWT_REFRESH_SECRET должны различаться")
	}
	return nil
}

func isPlaceholder(value string) bool {
	lower := strings.ToLower(value)
	return strings.Contains(lower, "change-me") || strings.Contains(lower, "changeme")
}

func findEnvFile(dir string) string {
	candidates := make([]string, 0, 6)
	if explicit := strings.TrimSpace(os.Getenv("ENV_FILE")); explicit != "" {
		candidates = append(candidates, explicit)
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, ".env"),
			filepath.Join(exeDir, "src", ".env"),
		)
	}
	if dir != "" {
		candidates = append(candidates,
			filepath.Join(dir, ".env"),
			filepath.Join(dir, "src", ".env"),
		)
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("ENV", envDevelopment)
	v.SetDefault("PORT", "8080")
	v.SetDefault("JWT_ACCESS_EXPIRES_IN", "15m")
	v.SetDefault("JWT_REFRESH_EXPIRES_IN", "168h")
	v.SetDefault("COOKIE_SECURE", false)
	v.SetDefault("COOKIE_SAME_SITE", "")
	v.SetDefault("BCRYPT_COST", 12)
	v.SetDefault("S3_REGION", "ru-1")
	v.SetDefault("SMTP_PORT", 587)
	v.SetDefault("SMTP_TLS", "starttls")
	v.SetDefault("HEALTH_CHECK_INTERVAL", "2h")
	v.SetDefault("HEARTBEAT_INTERVAL", "5m")
	v.SetDefault("RATE_LIMIT_ENABLED", true)
	v.SetDefault("RATE_LIMIT_GLOBAL_PER_MINUTE", 240)
	v.SetDefault("RATE_LIMIT_AUTH_PER_15MIN", 10)
	v.SetDefault("RATE_LIMIT_EMAIL_PER_HOUR", 5)
	v.SetDefault("RATE_LIMIT_REPORT_PER_HOUR", 5)
	v.SetDefault("TRUST_PROXY_HEADER", "X-Forwarded-For")
	v.SetDefault("INVITE_TTL_DAYS", 7)
}

func bindEnvs(v *viper.Viper) {
	keys := []string{
		"ENV", "PORT",
		"DATABASE_USERNAME", "DATABASE_NAME", "DATABASE_PASSWORD", "DATABASE_URL",
		"JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_ACCESS_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN",
		"COOKIE_DOMAIN", "COOKIE_SECURE", "COOKIE_SAME_SITE",
		"ALLOWED_ORIGINS", "BCRYPT_COST",
		"APP_BASE_URL", "REQUIRE_EMAIL_VERIFICATION",
		"SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_TLS",
		"TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "HEALTH_CHECK_INTERVAL",
		"HEARTBEAT_URL", "HEARTBEAT_INTERVAL",
		"RATE_LIMIT_ENABLED", "RATE_LIMIT_GLOBAL_PER_MINUTE", "RATE_LIMIT_AUTH_PER_15MIN",
		"RATE_LIMIT_EMAIL_PER_HOUR", "RATE_LIMIT_REPORT_PER_HOUR", "TRUST_PROXY_HEADER",
		"ADMIN_TOKEN", "REGISTRATION_INVITE_ONLY", "INVITE_TTL_DAYS",
	}
	for _, key := range keys {
		_ = v.BindEnv(key)
	}

	s3Keys := map[string][]string{
		"S3_ENDPOINT":          {"S3_ENDPOINT", "R2_ENDPOINT"},
		"S3_REGION":            {"S3_REGION", "R2_REGION"},
		"S3_ACCESS_KEY_ID":     {"S3_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"},
		"S3_SECRET_ACCESS_KEY": {"S3_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"},
		"S3_BUCKET":            {"S3_BUCKET", "R2_BUCKET"},
		"S3_PUBLIC_BASE_URL":   {"S3_PUBLIC_BASE_URL", "R2_PUBLIC_BASE_URL"},
	}
	for key, envs := range s3Keys {
		for _, env := range envs {
			_ = v.BindEnv(key, env)
		}
	}
}
