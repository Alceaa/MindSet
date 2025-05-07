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

	JwtSecret    string        `mapstructure:"JWT_SECRET"`
	JwtExpiresIn time.Duration `mapstructure:"JWT_EXPIRED_IN"`
	JwtMaxAge    int           `mapstructure:"JWT_MAXAGE"`
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
