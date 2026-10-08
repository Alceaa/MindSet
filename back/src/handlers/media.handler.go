package handlers

import (
	"fmt"
	"strings"
	"time"

	"mindset/media"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const presignTTL = 10 * time.Minute

var allowedImageTypes = map[string]string{
	"image/png":  "png",
	"image/jpeg": "jpg",
	"image/gif":  "gif",
	"image/webp": "webp",
}

func PresignUpload(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	if !media.Enabled() {
		return utils.Fail(c, fiber.StatusServiceUnavailable, "Загрузка изображений не настроена", nil)
	}

	var req struct {
		ContentType string `json:"content_type"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}

	contentType := strings.ToLower(strings.TrimSpace(strings.Split(req.ContentType, ";")[0]))
	ext, valid := allowedImageTypes[contentType]
	if !valid {
		return utils.Fail(c, fiber.StatusBadRequest, "Недопустимый тип изображения", nil)
	}

	key := fmt.Sprintf("sets/%d/%s.%s", user.ID, uuid.NewString(), ext)
	uploadURL, err := media.PresignPut(c.Context(), key, presignTTL)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось подготовить загрузку", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"upload_url":   uploadURL,
		"public_url":   media.PublicURL(key),
		"key":          key,
		"content_type": contentType,
	})
}
