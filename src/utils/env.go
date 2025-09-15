package utils

import (
	"time"

	"github.com/spf13/viper"
)

type Env struct {
	DBUsername string `mapstructure:"DATABASE_USERNAME"`
	DBName     string `mapstructure:"DATABASE_NAME"`
	DBPassword string `mapstructure:"DATABASE_PASSWORD"`
	DBUrl      string `mapstructure:"DATABSE_URL"`

	JwtAccessSecret     string        `mapstructure:"JWT_ACCESS_SECRET"`
	JwtRefreshSecret    string        `mapstructure:"JWT_REFRESH_SECRET"`
	JwtAccessExpiresIn  time.Duration `mapstructure:"JWT_ACCESS_EXPIRED_IN"`
	JwtRefreshExpiresIn time.Duration `mapstructure:"JWT_REFRESH_EXPIRES_IN"`
	JwtMaxAge           int           `mapstructure:"JWT_MAXAGE"`
}

func LoadEnv(path string) (Env Env, err error) {
	viper.AddConfigPath(path)
	viper.SetConfigType("env")
	viper.SetConfigName("mindset")

	viper.AutomaticEnv()

	err = viper.ReadInConfig()
	if err != nil {
		return
	}

	err = viper.Unmarshal(&Env)
	return
}
