package mailer

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
	TLS      string
}

var current Config

func Setup(cfg Config) {
	current = cfg

	if !Enabled() {
		log.Println("Почта: SMTP не настроен — письма печатаются в лог (dev-режим)")
		return
	}
	log.Printf("Почта: SMTP %s:%d (TLS: %s), отправитель %s", cfg.Host, cfg.Port, cfg.TLS, cfg.From)
}

func Enabled() bool {
	return strings.TrimSpace(current.Host) != "" && strings.TrimSpace(current.From) != ""
}

func Send(to, subject, body string) error {
	if strings.TrimSpace(to) == "" {
		return fmt.Errorf("mailer: пустой адрес получателя")
	}

	if !Enabled() {
		log.Printf("ПОЧТА (dev-режим, SMTP не настроен)\n  Кому:  %s\n  Тема:  %s\n%s", to, subject, indent(body))
		return nil
	}

	return sendSMTP(to, subject, body)
}

func SendVerificationEmail(to, login, link string, ttl time.Duration) error {
	body := fmt.Sprintf(`Привет, %s!

Вы указали этот адрес при регистрации в MindSet. Чтобы подтвердить почту, откройте ссылку:

%s

Ссылка действует %s. Если вы не регистрировались — просто проигнорируйте это письмо.
`, login, link, humanTTL(ttl))

	return Send(to, "Подтверждение почты в MindSet", body)
}

func SendPasswordResetEmail(to, login, link string, ttl time.Duration) error {
	body := fmt.Sprintf(`Привет, %s!

Кто-то запросил сброс пароля для вашего аккаунта MindSet. Чтобы задать новый пароль, откройте ссылку:

%s

Ссылка действует %s и сработает один раз. Если запрос сделали не вы — ничего делать не нужно,
пароль останется прежним.
`, login, link, humanTTL(ttl))

	return Send(to, "Сброс пароля в MindSet", body)
}

func NewToken() (token string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("mailer: генерация токена: %w", err)
	}
	token = hex.EncodeToString(buf)
	return token, HashToken(token), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func NewCode() (code string, hash string, err error) {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("mailer: генерация кода: %w", err)
	}
	code = fmt.Sprintf("%06d", binary.BigEndian.Uint32(buf)%1000000)
	return code, HashToken(code), nil
}

func SendLoginCode(to, login, code string, ttl time.Duration) error {
	body := fmt.Sprintf(`Привет, %s!

Код для входа в MindSet:

    %s

Код действует %s и сработает один раз. Если вы не входили — смените пароль.
`, login, code, humanTTL(ttl))

	return Send(to, "Код входа в MindSet", body)
}

func sendSMTP(to, subject, body string) error {
	addr := net.JoinHostPort(current.Host, strconv.Itoa(current.Port))
	implicit := strings.EqualFold(current.TLS, "implicit")

	var client *smtp.Client
	var err error
	if implicit {
		conn, dialErr := tls.Dial("tcp", addr, &tls.Config{
			ServerName: current.Host,
			MinVersion: tls.VersionTLS12,
		})
		if dialErr != nil {
			return fmt.Errorf("mailer: tls dial %s: %w", addr, dialErr)
		}
		client, err = smtp.NewClient(conn, current.Host)
	} else {
		client, err = smtp.Dial(addr)
	}
	if err != nil {
		return fmt.Errorf("mailer: подключение к %s: %w", addr, err)
	}
	defer client.Close()

	if !implicit && !strings.EqualFold(current.TLS, "none") {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{
				ServerName: current.Host,
				MinVersion: tls.VersionTLS12,
			}); err != nil {
				return fmt.Errorf("mailer: STARTTLS: %w", err)
			}
		}
	}

	if current.User != "" {
		if ok, _ := client.Extension("AUTH"); ok {
			auth := smtp.PlainAuth("", current.User, current.Password, current.Host)
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("mailer: авторизация: %w", err)
			}
		}
	}

	if err := client.Mail(addressOnly(current.From)); err != nil {
		return fmt.Errorf("mailer: MAIL FROM: %w", err)
	}
	if err := client.Rcpt(addressOnly(to)); err != nil {
		return fmt.Errorf("mailer: RCPT TO: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("mailer: DATA: %w", err)
	}
	if _, err := w.Write([]byte(buildMessage(to, subject, body))); err != nil {
		return fmt.Errorf("mailer: запись письма: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("mailer: завершение письма: %w", err)
	}

	return client.Quit()
}

func buildMessage(to, subject, body string) string {
	var b strings.Builder
	b.WriteString("From: " + current.From + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	b.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("Auto-Submitted: auto-generated\r\n")
	b.WriteString("\r\n")
	b.WriteString(strings.ReplaceAll(body, "\n", "\r\n"))
	b.WriteString("\r\n")
	return b.String()
}

func addressOnly(addr string) string {
	if i := strings.LastIndex(addr, "<"); i >= 0 {
		if j := strings.Index(addr[i:], ">"); j > 0 {
			return strings.TrimSpace(addr[i+1 : i+j])
		}
	}
	return strings.TrimSpace(addr)
}

func indent(s string) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	for i, line := range lines {
		lines[i] = "  | " + line
	}
	return strings.Join(lines, "\n")
}

func humanTTL(d time.Duration) string {
	switch {
	case d >= 24*time.Hour:
		days := int(d.Hours() / 24)
		return fmt.Sprintf("%d %s", days, plural(days, "день", "дня", "дней"))
	case d >= time.Hour:
		hours := int(d.Hours())
		return fmt.Sprintf("%d %s", hours, plural(hours, "час", "часа", "часов"))
	default:
		minutes := int(d.Minutes())
		return fmt.Sprintf("%d %s", minutes, plural(minutes, "минуту", "минуты", "минут"))
	}
}

func plural(n int, one, few, many string) string {
	if n%100 >= 11 && n%100 <= 14 {
		return many
	}
	switch n % 10 {
	case 1:
		return one
	case 2, 3, 4:
		return few
	default:
		return many
	}
}
