package main

import (
	"fmt"
	"os"
	"time"

	"mindset/mailer"
	"mindset/utils"
)

func main() {
	cfg := utils.Config()

	mailer.Setup(mailer.Config{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		User:     cfg.SMTPUser,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
		TLS:      cfg.SMTPTLS,
	})

	to := "delivered@resend.dev"
	if len(os.Args) > 1 {
		to = os.Args[1]
	}

	if err := mailer.SendLoginCode(to, "проверка", "123456", 10*time.Minute); err != nil {
		fmt.Println("ОШИБКА:", err)
		os.Exit(1)
	}
	fmt.Println("письмо отправлено на", to)
}
