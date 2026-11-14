package models

import (
	"fmt"
	"regexp"
	"strings"
)

// Библиотека тем: пользователь собирает несколько оформлений и переключается между ними.
// Каталога и модерации нет — тему делят файлом или текстом, поэтому у темы нет статусов.
const (
	ThemeLibraryLimit   = 10
	ThemeTitleMaxLength = 60
	ThemeDescriptionMax = 200
	ThemeKeyMaxLength   = 32
)

var (
	// Встроенные темы: они же — «база», поверх которой рисуются восемь ролей.
	ThemeBaseKeys = []string{"dark", "light", "sepia", "nord", "contrast"}
	ThemeModes    = []string{"light", "dark"}

	// Роли совпадают с THEME_ROLES на фронтенде (front/src/app/themes/theme.roles.js).
	ThemeRoleKeys = []string{
		"canvas", "surface", "text", "border", "accent", "danger", "warning", "success",
	}

	themeKeyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,31}$`)
	themeRoleHex    = regexp.MustCompile(`^#([0-9a-fA-F]{6})$`)
)

// ThemeLibraryItem — сохранённая тема: восемь ролей поверх одной из встроенных тем.
type ThemeLibraryItem struct {
	ID          int               `json:"id"`
	Key         string            `json:"key"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Mode        string            `json:"mode"`
	Base        string            `json:"base"`
	Roles       map[string]string `json:"roles"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
}

// ThemePayload — то, что приходит от клиента. Храним и передаём восемь ролей, а не 52
// переменные: из ролей выводятся все остальные значения, поэтому набор компактный и
// переживает изменения оформления приложения.
type ThemePayload struct {
	Title       string            `json:"title" validate:"required,min=3,max=60"`
	Description string            `json:"description" validate:"max=200"`
	Mode        string            `json:"mode" validate:"required,oneof=light dark"`
	Base        string            `json:"base" validate:"required,oneof=dark light sepia nord contrast"`
	Roles       map[string]string `json:"roles" validate:"required"`
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
// Ключ уникален в пределах одного автора, поэтому конфликт решается приставкой числа.
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

func IsThemeRole(name string) bool {
	for _, role := range ThemeRoleKeys {
		if role == name {
			return true
		}
	}
	return false
}

// ValidateThemeRoles проверяет роли: имена из фиксированного списка, значения — #rrggbb.
func ValidateThemeRoles(roles map[string]string) error {
	if len(roles) == 0 {
		return fmt.Errorf("задайте хотя бы один цвет темы")
	}

	for name, value := range roles {
		if !IsThemeRole(name) {
			return fmt.Errorf("роль %q не поддерживается", name)
		}
		if !themeRoleHex.MatchString(strings.TrimSpace(value)) {
			return fmt.Errorf("цвет у роли %q: нужен вид #rrggbb", name)
		}
	}

	return nil
}

// NormalizeThemeRoles приводит цвета к нижнему регистру и убирает пробелы,
// чтобы одинаковые цвета не выглядели разными.
func NormalizeThemeRoles(roles map[string]string) map[string]string {
	normalized := make(map[string]string, len(roles))
	for name, value := range roles {
		normalized[name] = strings.ToLower(strings.TrimSpace(value))
	}
	return normalized
}
