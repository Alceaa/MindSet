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

func TestValidThemeColor(t *testing.T) {
	valid := []string{
		"#fff",
		"#0d0f14",
		"#0d0f14ff",
		"rgba(226, 176, 83, 0.14)",
		"rgba(0,0,0,1)",
		"rgb(12, 34, 56)",
	}

	invalid := []string{
		"",
		"red",
		"#12345",
		"#gggggg",
		"url(https://example.com/x.png)",
		"var(--accent)",
		"expression(alert(1))",
		"rgba(1, 2, 3, 2)",
		"#fff;} body {display:none",
		"background: red",
	}

	for _, value := range valid {
		if !ValidThemeColor(value) {
			t.Errorf("цвет %q отвергнут, хотя допустим", value)
		}
	}
	for _, value := range invalid {
		if ValidThemeColor(value) {
			t.Errorf("значение %q принято как цвет", value)
		}
	}
}

func TestValidateThemeVariables(t *testing.T) {
	if err := ValidateThemeVariables(map[string]string{
		"--bg-canvas": "#101015",
		"--accent":    "rgba(124, 199, 255, 0.9)",
	}); err != nil {
		t.Fatalf("корректный набор отвергнут: %v", err)
	}

	if err := ValidateThemeVariables(map[string]string{}); err == nil {
		t.Error("пустой набор принят")
	}

	if err := ValidateThemeVariables(map[string]string{"--shadow": "0 0 4px black"}); err == nil {
		t.Error("сложная переменная принята")
	}
	if err := ValidateThemeVariables(map[string]string{"--no-such-var": "#fff"}); err == nil {
		t.Error("неизвестная переменная принята")
	}
	if err := ValidateThemeVariables(map[string]string{"--accent": "blue"}); err == nil {
		t.Error("слово вместо цвета принято")
	}

	seen := map[string]bool{}
	all := map[string]string{}
	for _, name := range ThemeColorVariables {
		if seen[name] {
			t.Errorf("переменная %s повторяется в белом списке", name)
		}
		seen[name] = true
		all[name] = "#ffffff"
	}
	if err := ValidateThemeVariables(all); err != nil {
		t.Errorf("полный белый список отвергнут: %v", err)
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
