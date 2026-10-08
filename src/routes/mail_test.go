package routes

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"mindset/mailer"

	"github.com/gofiber/fiber/v2"
)

type miniSMTP struct {
	ln   net.Listener
	mu   sync.Mutex
	msgs []string
	host string
	port int
}

var testMail *miniSMTP

var loginCodePattern = regexp.MustCompile(`(?m)^    (\d{6})\r?$`)

func setupTestMailer() error {
	srv, err := startMiniSMTP()
	if err != nil {
		return err
	}

	testMail = srv
	mailer.Setup(mailer.Config{
		Host: srv.host,
		Port: srv.port,
		From: "MindSet <no-reply@mindset.test>",
		TLS:  "none",
	})

	return nil
}

func startMiniSMTP() (*miniSMTP, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}

	srv := &miniSMTP{
		ln:   ln,
		host: "127.0.0.1",
		port: ln.Addr().(*net.TCPAddr).Port,
	}
	go srv.serve()

	return srv, nil
}

func (s *miniSMTP) serve() {
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		go s.handle(conn)
	}
}

func (s *miniSMTP) handle(conn net.Conn) {
	defer conn.Close()

	reader := bufio.NewReader(conn)
	reply := func(line string) { _, _ = conn.Write([]byte(line + "\r\n")) }

	reply("220 mini smtp")

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}

		switch cmd := strings.ToUpper(strings.TrimSpace(line)); {
		case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
			reply("250 mini")
		case strings.HasPrefix(cmd, "MAIL FROM"), strings.HasPrefix(cmd, "RCPT TO"):
			reply("250 ok")
		case cmd == "DATA":
			reply("354 end with <CRLF>.<CRLF>")
			var body strings.Builder
			for {
				part, err := reader.ReadString('\n')
				if err != nil {
					return
				}
				if strings.TrimRight(part, "\r\n") == "." {
					break
				}
				body.WriteString(part)
			}
			s.push(body.String())
			reply("250 queued")
		case cmd == "QUIT":
			reply("221 bye")
			return
		default:
			reply("250 ok")
		}
	}
}

func (s *miniSMTP) push(message string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.msgs = append(s.msgs, message)
}

func (s *miniSMTP) last(t *testing.T) string {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		if len(s.msgs) > 0 {
			message := s.msgs[0]
			s.msgs = s.msgs[1:]
			s.mu.Unlock()
			return message
		}
		s.mu.Unlock()

		time.Sleep(20 * time.Millisecond)
	}

	t.Fatal("письмо не пришло за 5 секунд")
	return ""
}

func (s *miniSMTP) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.msgs = nil
}

func incomingMail(t *testing.T) *miniSMTP {
	t.Helper()

	if testMail == nil {
		t.Fatal("мини-SMTP не поднят в TestMain")
	}
	return testMail
}

func linkToken(t *testing.T, message, path string) string {
	t.Helper()

	prefix := path + "?token="
	idx := strings.Index(message, prefix)
	if idx < 0 {
		t.Fatalf("в письме нет ссылки %s:\n%s", path, message)
	}

	rest := message[idx+len(prefix):]
	if end := strings.IndexAny(rest, " \t\r\n"); end >= 0 {
		return rest[:end]
	}
	return rest
}

func readVerificationToken(t *testing.T) string {
	t.Helper()

	return linkToken(t, incomingMail(t).last(t), "/verify-email")
}

func readLoginCode(t *testing.T) string {
	t.Helper()

	message := incomingMail(t).last(t)
	matches := loginCodePattern.FindStringSubmatch(message)
	if matches == nil {
		t.Fatalf("в письме нет кода входа:\n%s", message)
	}
	return matches[1]
}

func uniqueTestLogin(t *testing.T, prefix string) string {
	t.Helper()

	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func loginCookies(t *testing.T, app *fiber.App, login, password string) []*http.Cookie {
	t.Helper()

	resp, _, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/login",
		Body:   map[string]string{"login": login, "password": password},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("вход %s = %d, ожидалось 200: %s", login, resp.StatusCode, raw)
	}

	return []*http.Cookie{cookieByName(t, resp.Cookies(), "access_token")}
}

func registerUser(t *testing.T, app *fiber.App, login, email, password string) (*http.Response, apiResponse, string) {
	t.Helper()

	return call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/register",
		Body: map[string]string{
			"login":            login,
			"email":            email,
			"password":         password,
			"password_confirm": password,
		},
	})
}

func verifyEmail(t *testing.T, app *fiber.App, token string) apiResponse {
	t.Helper()

	resp, body, raw := call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email",
		Body:   map[string]string{"token": token},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("подтверждение почты = %d, ожидалось 200: %s", resp.StatusCode, raw)
	}
	if body.User == nil {
		t.Fatalf("в ответе подтверждения нет пользователя: %s", raw)
	}

	return body
}

func registerVerified(t *testing.T, app *fiber.App, login, email, password string) []*http.Cookie {
	t.Helper()

	resp, _, raw := registerUser(t, app, login, email, password)
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("регистрация %s = %d, ожидалось 202: %s", login, resp.StatusCode, raw)
	}

	resp, _, raw = call(t, app, callOptions{
		Method: fiber.MethodPost,
		Path:   "/auth/verify-email",
		Body:   map[string]string{"token": readVerificationToken(t)},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("подтверждение почты %s = %d: %s", login, resp.StatusCode, raw)
	}

	return []*http.Cookie{cookieByName(t, resp.Cookies(), "access_token")}
}
