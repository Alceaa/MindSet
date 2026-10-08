package notify

import (
	"fmt"
	"strings"
	"time"
)

func BugReportText(author, page, topic, message string) string {
	if strings.TrimSpace(author) == "" {
		author = "аноним"
	}

	return fmt.Sprintf("🐞 Баг-репорт\nАвтор: %s\nСтраница: %s\nТема: %s\n\n%s",
		author, orDash(page), orDash(topic), strings.TrimSpace(message))
}

func ServerErrorText(method, path string, status int, author, details string) string {
	if strings.TrimSpace(author) == "" {
		author = "аноним"
	}

	text := fmt.Sprintf("🔥 Ошибка %d\n%s %s\nПользователь: %s", status, method, path, author)
	if details = strings.TrimSpace(details); details != "" {
		text += "\n\n" + truncate(details, 700)
	}
	return text
}

func HealthAlertText(details string, uptime time.Duration) string {
	return fmt.Sprintf("🛑 /health не отвечает\nЧто проверяли: %s\nСервер работает: %s\n\n%s",
		orDash(details), humanDuration(uptime), time.Now().Format("2006-01-02 15:04:05"))
}

func HealthRecoveryText(details string, uptime time.Duration) string {
	return fmt.Sprintf("✅ /health снова в норме\n%s\nСервер работает: %s",
		orDash(details), humanDuration(uptime))
}

func orDash(value string) string {
	if value = strings.TrimSpace(value); value == "" {
		return "—"
	}
	return value
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}

func humanDuration(d time.Duration) string {
	switch {
	case d >= 24*time.Hour:
		days := int(d.Hours() / 24)
		return fmt.Sprintf("%d %s", days, plural(days, "день", "дня", "дней"))
	case d >= time.Hour:
		hours := int(d.Hours())
		return fmt.Sprintf("%d %s", hours, plural(hours, "час", "часа", "часов"))
	case d >= time.Minute:
		minutes := int(d.Minutes())
		return fmt.Sprintf("%d %s", minutes, plural(minutes, "минуту", "минуты", "минут"))
	default:
		return "меньше минуты"
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
