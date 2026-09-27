package middlewares

import (
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func RequireJSONBody(c *fiber.Ctx) error {
	switch c.Method() {
	case fiber.MethodPost, fiber.MethodPut, fiber.MethodPatch:
		if len(c.Body()) == 0 {
			return c.Next()
		}
		if !c.Is("json") {
			return utils.Fail(c, fiber.StatusUnsupportedMediaType, "Ожидается Content-Type: application/json", nil)
		}
	}
	return c.Next()
}
