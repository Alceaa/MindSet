package models

import (
	"strings"
	"testing"
)

func TestValidThemeKey(t *testing.T) {
	valid := []string{"northern", "my-theme-2", "a1b"}
	invalid := []string{"", "ab", "Theme", "-theme", "theme_1", "тема", strings.Repeat("a", 33)}

	for _, key := range valid {
		if !ValidThemeKey(key) {
			t.Errorf("ключ %q отвергнут, хотя допустим", key)
		}
	}
	for _, key := range invalid {
		if ValidThemeKey(key) {
			t.Errorf("ключ %q принят, хотя недопустим", key)
		}
	}
}

// Ключ темы автору придумывать не нужно: он собирается из названия, а занятый
// заменяется свободным кандидатом (base, base-2, base-3…).
func TestThemeKeyFromTitle(t *testing.T) {
	tests := []struct {
		title string
		want  string
	}{
		{title: "Тёплый вечер", want: "teplyy-vecher"},
		{title: "Quiet Forest", want: "quiet-forest"},
		{title: "Ocean Horizon 2", want: "ocean-horizon-2"},
		{title: "  Мои   цвета  ", want: "moi-cveta"},
		{title: "СЕВЕРНОЕ СИЯНИЕ", want: "severnoe-siyanie"},
		{title: "!!!", want: "theme"},
		{title: "тема", want: "tema"},
	}

	for _, testCase := range tests {
		if got := ThemeKeyFromTitle(testCase.title); got != testCase.want {
			t.Errorf("ThemeKeyFromTitle(%q) = %q, ожидалось %q", testCase.title, got, testCase.want)
		}
	}
}

func TestThemeKeyFromTitleAlwaysValid(t *testing.T) {
	titles := []string{
		"Очень длинное название темы для проверки длины ключа",
		strings.Repeat("я", 60),
		"2026 — год",
		"",
	}

	for _, title := range titles {
		key := ThemeKeyFromTitle(title)
		if !ValidThemeKey(key) || len(key) > ThemeKeyMaxLength {
			t.Errorf("ThemeKeyFromTitle(%q) = %q, ключ недопустим", title, key)
		}
	}
}

func TestThemeKeyCandidate(t *testing.T) {
	tests := []struct {
		base    string
		attempt int
		want    string
	}{
		{base: "forest", attempt: 0, want: "forest"},
		{base: "forest", attempt: 1, want: "forest-2"},
		{base: "forest", attempt: 2, want: "forest-3"},
	}

	for _, testCase := range tests {
		got := ThemeKeyCandidate(testCase.base, testCase.attempt)
		if got != testCase.want {
			t.Errorf("ThemeKeyCandidate(%q, %d) = %q, ожидалось %q",
				testCase.base, testCase.attempt, got, testCase.want)
		}
	}

	long := strings.Repeat("a", ThemeKeyMaxLength)
	for attempt := 1; attempt <= 3; attempt++ {
		got := ThemeKeyCandidate(long, attempt)
		if len(got) > ThemeKeyMaxLength || !ValidThemeKey(got) {
			t.Errorf("кандидат %q недопустим", got)
		}
	}
}

func TestValidateThemeRoles(t *testing.T) {
	valid := map[string]string{
		"canvas":  "#101015",
		"surface": "#181C22",
		"text":    "#e8eaee",
		"border":  "#2a2f38",
		"accent":  "#9db4d0",
		"danger":  "#e07a7a",
		"warning": "#d8b06a",
		"success": "#86c9a2",
	}
	if err := ValidateThemeRoles(valid); err != nil {
		t.Fatalf("корректные роли отвергнуты: %v", err)
	}

	if err := ValidateThemeRoles(map[string]string{}); err == nil {
		t.Error("пустой набор принят")
	}
	if err := ValidateThemeRoles(map[string]string{"shadow": "#ffffff"}); err == nil {
		t.Error("неизвестная роль принята")
	}
	// Роли принимают только #rrggbb: сокращения и rgba остались в прошлом формате переменных.
	for _, value := range []string{"#fff", "rgba(226, 176, 83, 0.14)", "blue", "url(x)"} {
		if err := ValidateThemeRoles(map[string]string{"accent": value}); err == nil {
			t.Errorf("цвет %q принят как роль темы", value)
		}
	}
}

func TestNormalizeThemeRoles(t *testing.T) {
	normalized := NormalizeThemeRoles(map[string]string{"accent": "  #5FC4D8  "})

	if normalized["accent"] != "#5fc4d8" {
		t.Errorf("роль не нормализована: %q", normalized["accent"])
	}
}

func TestValidThemeBaseAndModes(t *testing.T) {
	if !ValidThemeBase("sepia") {
		t.Error("sepia не признана базовой темой")
	}
	if ValidThemeBase("neon") {
		t.Error("неизвестная база принята")
	}
	if len(ThemeModes) != 2 || ThemeModes[0] != "light" || ThemeModes[1] != "dark" {
		t.Errorf("режимы темы изменились: %v", ThemeModes)
	}
}
