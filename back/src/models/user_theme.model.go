package models

import (
	"fmt"
	"regexp"
	"strings"
)

// Тема пользователя — восемь ролей поверх одной из встроенных тем. Ключи ролей совпадают
// с THEME_ROLES на фронтенде, из них выводятся все остальные переменные оформления.
type UserTheme struct {
	Title string            `json:"title" validate:"max=40"`
	Mode  string            `json:"mode" validate:"required,oneof=light dark"`
	Base  string            `json:"base" validate:"required,oneof=dark light sepia nord contrast"`
	Roles map[string]string `json:"roles"`
}

// Роли темы: те же имена, что в front/src/app/themes/theme.roles.js.
var UserThemeRoles = []string{
	"canvas", "surface", "text", "border", "accent", "danger", "warning", "success",
}

var userThemeHex = regexp.MustCompile(`^#([0-9a-fA-F]{6})$`)

// ValidateUserTheme проверяет роли: имена из фиксированного списка, значения — только #rrggbb.
func ValidateUserTheme(theme UserTheme) error {
	if len(theme.Roles) == 0 {
		return fmt.Errorf("задайте хотя бы один цвет темы")
	}

	for name, value := range theme.Roles {
		if !IsUserThemeRole(name) {
			return fmt.Errorf("роль %q не поддерживается", name)
		}
		if !userThemeHex.MatchString(strings.TrimSpace(value)) {
			return fmt.Errorf("цвет у роли %q: нужен вид #rrggbb", name)
		}
	}

	return nil
}

func IsUserThemeRole(name string) bool {
	for _, role := range UserThemeRoles {
		if role == name {
			return true
		}
	}
	return false
}

// NormalizeUserThemeRoles приводит цвета к нижнему регистру и убирает пробелы,
// чтобы одинаковые цвета не выглядели разными.
func NormalizeUserThemeRoles(roles map[string]string) map[string]string {
	normalized := make(map[string]string, len(roles))
	for name, value := range roles {
		normalized[name] = strings.ToLower(strings.TrimSpace(value))
	}
	return normalized
}
