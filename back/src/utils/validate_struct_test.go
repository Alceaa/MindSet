package utils

import (
	"strings"
	"testing"

	"mindset/models"
)

func TestValidateStructReturnsFriendlyFieldNames(t *testing.T) {
	req := models.RegisterReg{Login: "", Email: "не-почта", Password: "short", PasswordConfirm: "other"}

	errors := ValidateStruct(req)
	if len(errors) == 0 {
		t.Fatal("ожидались ошибки валидации")
	}

	byField := make(map[string]*models.ErrorResponse, len(errors))
	for _, item := range errors {
		byField[item.Field] = item
		if item.Message == "" {
			t.Errorf("для поля %s не сформирован текст ошибки", item.Field)
		}
	}

	if _, ok := byField["password_confirm"]; !ok {
		t.Errorf("нет ошибки для password_confirm, получено: %v", errors)
	}
	if _, ok := byField["email"]; !ok {
		t.Errorf("нет ошибки для email, получено: %v", errors)
	}
	if _, ok := byField["login"]; !ok {
		t.Errorf("нет ошибки для login, получено: %v", errors)
	}

	if got := byField["login"].Tag; got != "required" {
		t.Errorf("tag для login = %q, ожидалось \"required\"", got)
	}
}

func TestValidateStructValidPayload(t *testing.T) {
	req := models.RegisterReg{
		Login:           "octocat",
		Email:           "octo@example.com",
		Password:        "sup3r-secret",
		PasswordConfirm: "sup3r-secret",
	}

	if errors := ValidateStruct(req); len(errors) != 0 {
		t.Fatalf("валидный запрос дал ошибки: %v", errors)
	}
}

func TestValidateStructPasswordMismatch(t *testing.T) {
	req := models.RegisterReg{
		Login:           "octocat",
		Email:           "octo@example.com",
		Password:        "sup3r-secret",
		PasswordConfirm: "another-password",
	}

	errors := ValidateStruct(req)
	found := false
	for _, item := range errors {
		if item.Field == "password_confirm" && item.Tag == "eqfield" {
			found = true
		}
	}
	if !found {
		t.Fatalf("не найдена ошибка eqfield для password_confirm: %v", errors)
	}
}

func TestRegisterLoginRejectsAtSign(t *testing.T) {
	req := models.RegisterReg{
		Login:           "octo@cat",
		Email:           "octo@example.com",
		Password:        "sup3r-secret",
		PasswordConfirm: "sup3r-secret",
	}

	var hasExcludesAll bool
	for _, item := range ValidateStruct(req) {
		if item.Field == "login" && item.Tag == "excludesall" {
			hasExcludesAll = true
			if item.Message == "" {
				t.Error("нет текста ошибки для недопустимого символа")
			}
		}
	}
	if !hasExcludesAll {
		t.Fatalf("логин с символом @ не был отклонён: %v", ValidateStruct(req))
	}
}

func TestLoginRegRejectsEmptyCredentials(t *testing.T) {
	cases := map[string]models.LoginReg{
		"пустой логин":  {Login: "", Password: "sup3r-secret"},
		"пустой пароль": {Login: "octocat", Password: ""},
	}

	for name, req := range cases {
		t.Run(name, func(t *testing.T) {
			if errors := ValidateStruct(req); len(errors) == 0 {
				t.Fatalf("ожидалась ошибка валидации для %q", name)
			}
		})
	}
}

func TestValidateSetPayload(t *testing.T) {
	req := models.SetPayload{
		Title:       "",
		Description: strings.Repeat("a", 300),
		Content:     strings.Repeat("b", 200001),
	}

	fields := map[string]bool{}
	for _, item := range ValidateStruct(req) {
		fields[item.Field] = true
	}

	if !fields["title"] {
		t.Error("пустое название сета не было отклонено")
	}
	if !fields["description"] {
		t.Error("слишком длинное описание не было отклонено")
	}
	if !fields["content"] {
		t.Error("слишком большое содержимое не было отклонено")
	}
}

func TestValidateSetPayloadAcceptsMarkdown(t *testing.T) {
	req := models.SetPayload{
		Title:       "Сет",
		Description: "описание",
		Content:     "# Заголовок\n\n- пункт\n- пункт\n\n```go\nfmt.Println(\"hi\")\n```\n",
	}

	if errors := ValidateStruct(req); len(errors) != 0 {
		t.Fatalf("валидный markdown не прошёл валидацию: %v", errors)
	}
}

func TestToSnakeCase(t *testing.T) {
	cases := map[string]string{
		"PasswordConfirm": "password_confirm",
		"Login":           "login",
		"Email":           "email",
		"DateJoined":      "date_joined",
	}
	for input, want := range cases {
		if got := toSnakeCase(input); got != want {
			t.Errorf("toSnakeCase(%q) = %q, ожидалось %q", input, got, want)
		}
	}
}
