package utils

import (
	"mindset/models"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

func ValidateStruct[T any](payload T) []*models.ErrorResponse {
	var errors []*models.ErrorResponse
	err := validate.Struct(payload)
	if err != nil {
		for _, err := range err.(validator.ValidationErrors) {
			var element models.ErrorResponse
			element.Field = err.StructNamespace()
			element.Tag = err.Tag()
			element.Value = err.Param()
			errors = append(errors, &element)
		}
	}
	return errors
}
