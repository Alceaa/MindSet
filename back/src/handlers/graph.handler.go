package handlers

import (
	"mindset/db"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func GetGraph(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	graph, err := db.GetGraph(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось построить граф связей", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"nodes": graph.Nodes,
		"edges": graph.Edges,
	})
}
