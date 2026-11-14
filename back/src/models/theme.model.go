package models

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

const (
	ThemeStatusDraft    = "draft"
	ThemeStatusPending  = "pending"
	ThemeStatusApproved = "approved"
	ThemeStatusRejected = "rejected"
)

// Имя уникального индекса на theme_packages.theme_key: по нему отличаем занятый ключ
// от других конфликтов вставки.
const ThemeKeyConstraint = "theme_packages_key_uq"

const (
	ThemeKeyMaxLength       = 32
	ThemeTitleMaxLength     = 60
	ThemeDescriptionMax     = 200
	ThemeModerationNoteMax  = 300
	ThemeMaxPackagesPerUser = 10
)

var (
	ThemeBaseKeys = []string{"dark", "light", "sepia", "nord", "contrast"}
	ThemeModes    = []string{"light", "dark"}

	themeKeyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,31}$`)
	themeHexPattern = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)
	themeRGBA       = regexp.MustCompile(`^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0\.[0-9]{1,4}))?\s*\)$`)
)

var ThemeColorVariables = []string{
	"--bg-canvas",
	"--bg-surface",
	"--bg-surface-muted",
	"--bg-surface-hover",
	"--bg-inset",
	"--border",
	"--border-muted",
	"--text",
	"--text-muted",
	"--text-faint",
	"--accent",
	"--accent-hover",
	"--accent-soft",
	"--accent-tint",
	"--accent-tint-strong",
	"--accent-line",
	"--accent-line-strong",
	"--on-accent",
	"--success",
	"--success-soft",
	"--success-line",
	"--danger",
	"--danger-hover",
	"--danger-soft",
	"--danger-line",
	"--warning",
	"--warning-soft",
	"--warning-line",
	"--overlay",
	"--header-bg",
	"--code-bg",
	"--code-text",
	"--code-comment",
	"--code-keyword",
	"--code-string",
	"--code-number",
	"--graph-edge",
	"--graph-edge-soft",
	"--graph-arrow",
	"--graph-frozen",
	"--graph-frozen-soft",
	"--graph-deleted",
	"--graph-deleted-soft",
	"--graph-neighbor",
	"--collection-amber",
	"--collection-blue",
	"--collection-green",
	"--collection-purple",
	"--collection-red",
	"--collection-teal",
	"--auth-glow",
	"--fade-shadow",
}

type ThemePackage struct {
	ID          int               `json:"id"`
	Key         string            `json:"key"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Mode        string            `json:"mode"`
	Base        string            `json:"base"`
	Variables   map[string]string `json:"variables"`
	Status      string            `json:"status"`
	Note        string            `json:"moderation_note"`
	Author      string            `json:"author"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
	PublishedAt string            `json:"published_at"`

	// Pending — правка опубликованной темы, которая ждёт модерации. Пока админ её не одобрит,
	// в каталоге работает прежняя версия: автор правит тему сам, без «отзыва» через админа.
	Pending *ThemePending `json:"pending,omitempty"`
}

// ThemePending — отложенная правка темы: то же, что манифест, но ещё не опубликовано.
type ThemePending struct {
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Mode        string            `json:"mode"`
	Base        string            `json:"base"`
	Variables   map[string]string `json:"variables"`
}

type ThemePayload struct {
	// Key клиент может не присылать: ключ собирается из названия темы (ThemeKeyFromTitle),
	// а занятый ключ заменяется свободным. Значение из запроса не используется.
	Key         string            `json:"key" validate:"omitempty,min=3,max=32"`
	Title       string            `json:"title" validate:"required,min=3,max=60"`
	Description string            `json:"description" validate:"max=200"`
	Mode        string            `json:"mode" validate:"required,oneof=light dark"`
	Base        string            `json:"base" validate:"required,oneof=dark light sepia nord contrast"`
	Variables   map[string]string `json:"variables"`
}

// Транслит для ключей тем: ключ должен быть из латиницы, цифр и дефиса, а названия
// у тем обычно русские. Транслитерация без изысков — лишь бы ключ читался.
var themeTranslit = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "h", 'ц': "c", 'ч': "ch", 'ш': "sh", 'щ': "sch",
	'ъ': "", 'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
}

var themeKeyCleanup = regexp.MustCompile(`[^a-z0-9-]+`)

// ThemeKeyFromTitle собирает ключ темы из названия: латиница, цифры и дефис, 3–32 символа.
// Ключ придумывать не нужно — как slug у сета, он получается из названия.
func ThemeKeyFromTitle(title string) string {
	lowered := strings.ToLower(strings.TrimSpace(title))

	var builder strings.Builder
	for _, symbol := range lowered {
		if replacement, ok := themeTranslit[symbol]; ok {
			builder.WriteString(replacement)
			continue
		}
		builder.WriteRune(symbol)
	}

	key := themeKeyCleanup.ReplaceAllString(builder.String(), "-")
	key = strings.Trim(strings.Join(strings.Fields(strings.ReplaceAll(key, "-", " ")), "-"), "-")

	if len(key) > ThemeKeyMaxLength {
		key = strings.Trim(key[:ThemeKeyMaxLength], "-")
	}

	if !ValidThemeKey(key) {
		return "theme"
	}

	return key
}

// ThemeKeyCandidate — кандидат ключа для повторной попытки: base, base-2, base-3…
func ThemeKeyCandidate(base string, attempt int) string {
	if attempt <= 0 {
		return base
	}

	suffix := fmt.Sprintf("-%d", attempt+1)
	if len(base)+len(suffix) > ThemeKeyMaxLength {
		base = strings.Trim(base[:ThemeKeyMaxLength-len(suffix)], "-")
	}

	return base + suffix
}

type ThemeStatusPayload struct {
	Status string `json:"status" validate:"required,oneof=approved rejected"`
	Note   string `json:"note" validate:"max=300"`
}

func ValidThemeKey(key string) bool {
	return themeKeyPattern.MatchString(strings.TrimSpace(key))
}

func ValidThemeBase(base string) bool {
	for _, item := range ThemeBaseKeys {
		if item == base {
			return true
		}
	}
	return false
}

func ValidThemeColor(value string) bool {
	trimmed := strings.TrimSpace(value)
	return themeHexPattern.MatchString(trimmed) || themeRGBA.MatchString(trimmed)
}

func ValidateThemeVariables(variables map[string]string) error {
	if len(variables) == 0 {
		return fmt.Errorf("укажите хотя бы одну переменную")
	}

	names := make([]string, 0, len(variables))
	for name := range variables {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		value := variables[name]

		known := false
		for _, allowed := range ThemeColorVariables {
			if allowed == name {
				known = true
				break
			}
		}
		if !known {
			return fmt.Errorf("переменная %s не поддерживается", name)
		}
		if !ValidThemeColor(value) {
			return fmt.Errorf("значение %q у %s: нужен цвет вида #rgb, #rrggbb или rgba(r, g, b, a)", value, name)
		}
	}

	return nil
}
