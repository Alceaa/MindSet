package middlewares

import (
	"errors"
	"fmt"
	"strings"

	"mindset/notify"

	"github.com/gofiber/fiber/v2"
)

func AlertServerErrors(c *fiber.Ctx) error {
	err := c.Next()

	status := c.Response().StatusCode()
	if err != nil {
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			status = fiberErr.Code
		} else {
			status = fiber.StatusInternalServerError
		}
	}

	if status >= fiber.StatusInternalServerError {
		author := ""
		if user, ok := CurrentUser(c); ok {
			author = user.Login
		}

		details := ""
		if err != nil {
			details = err.Error()
		}

		path := c.Route().Path
		if strings.TrimSpace(path) == "" {
			path = c.Path()
		}

		notify.Alert(
			fmt.Sprintf("server-error:%s:%s:%d", c.Method(), path, status),
			notify.ServerErrorText(c.Method(), path, status, author, details),
		)
	}

	return err
}
