package utils

import (
	"fmt"
	"strings"
	"unicode"

	"mindset/models"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

var fieldLabels = map[string]string{
	"login":            "Логин",
	"email":            "Почта",
	"password":         "Пароль",
	"password_confirm": "Подтверждение пароля",
	"title":            "Название",
	"description":      "Описание",
}

func ValidateStruct[T any](payload T) []*models.ErrorResponse {
	err := validate.Struct(payload)
	if err == nil {
		return nil
	}

	validationErrors, ok := err.(validator.ValidationErrors)
	if !ok {
		return nil
	}

	errors := make([]*models.ErrorResponse, 0, len(validationErrors))
	for _, validationError := range validationErrors {
		field := toSnakeCase(validationError.StructField())
		errors = append(errors, &models.ErrorResponse{
			Field:   field,
			Tag:     validationError.Tag(),
			Value:   validationError.Param(),
			Message: validationMessage(field, validationError),
		})
	}
	return errors
}

func validationMessage(field string, err validator.FieldError) string {
	label := fieldLabels[field]
	if label == "" {
		label = "Поле"
	}

	switch err.Tag() {
	case "required":
		return fmt.Sprintf("%s обязательно для заполнения", label)
	case "min":
		return fmt.Sprintf("%s: минимальная длина — %s", label, err.Param())
	case "max":
		return fmt.Sprintf("%s: максимальная длина — %s", label, err.Param())
	case "email":
		return "Некорректный адрес почты"
	case "excludesall":
		return fmt.Sprintf("%s содержит недопустимые символы: %s", label, err.Param())
	case "eqfield":
		return "Значения полей не совпадают"
	default:
		return fmt.Sprintf("%s заполнено некорректно", label)
	}
}

func toSnakeCase(value string) string {
	var builder strings.Builder
	for i, r := range value {
		if unicode.IsUpper(r) {
			if i > 0 {
				builder.WriteRune('_')
			}
			builder.WriteRune(unicode.ToLower(r))
			continue
		}
		builder.WriteRune(r)
	}
	return builder.String()
}
