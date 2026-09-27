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

func (e Env) IsDevelopment() bool {
	return !e.IsProduction()
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
	return nil
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
}
