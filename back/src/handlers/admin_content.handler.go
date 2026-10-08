package handlers

import (
	"errors"
	"strings"
	"time"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func ListAdminSets(c *fiber.Ctx) error {
	sets, err := db.ListAdminSets(c.Context(),
		strings.TrimSpace(c.Query("q")),
		c.QueryInt("limit", 30),
		c.QueryInt("offset", 0),
	)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сеты", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"sets": sets})
}

func DeleteAdminSet(c *fiber.Ctx) error {
	if _, ok := middlewares.CurrentUser(c); !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор сета", err)
	}

	forbidCopies := c.QueryBool("forbid_copies", false)
	title := ""

	err = db.WithTx(c.Context(), func(tx pgx.Tx) error {
		existing, err := db.LockSetForAdminDelete(c.Context(), tx, id)
		if err != nil {
			return err
		}
		title = existing.Title

		if forbidCopies || !existing.Visibility.ReadableByOthers() {
			if err := db.PurgeSavedSetsOfSet(c.Context(), tx, existing.ID); err != nil {
				return err
			}
		} else {
			deadline := time.Now().AddDate(0, 0, 30)
			tombstoneID, err := db.SetTombstone(c.Context(), tx, existing.ID, existing.UserID, deadline, false)
			if err != nil {
				return err
			}
			if err := db.FreezeSavedSets(c.Context(), tx, existing.ID); err != nil {
				return err
			}
			if err := db.LinkSavedSetsToTombstone(c.Context(), tx, existing.ID, tombstoneID); err != nil {
				return err
			}
		}

		return db.DeleteSetAsAdmin(c.Context(), tx, id)
	})
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Сет не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось удалить сет", err)
	}

	recordAction(c, "delete_set", "set", id, title)

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Сет удалён"})
}

func ListAdminReports(c *fiber.Ctx) error {
	reports, err := db.ListBugReports(c.Context(), strings.TrimSpace(c.Query("status")), c.QueryInt("limit", 50))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить репорты", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"reports": reports})
}

func UpdateReportStatus(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор репорта", err)
	}

	req := models.ReportStatusPayload{}
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	err = db.SetBugReportStatus(c.Context(), id, req.Status)
	switch {
	case errors.Is(err, db.ErrNotFound):
		return utils.Fail(c, fiber.StatusNotFound, "Репорт не найден", nil)
	case err != nil:
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось изменить статус", err)
	}

	recordAction(c, "report_status", "report", id, req.Status)

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Статус обновлён"})
}
