package handlers

import (
	"archive/zip"
	"bufio"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode"

	"mindset/db"
	"mindset/middlewares"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

const exportReadme = `MindSet — выгрузка данных

sets/       ваши сеты: по одному файлу .md на заметку
saved/      сохранённые сеты других авторов (снимки на момент сохранения)
sets.json   метаданные: названия, описания, доступ, даты, источники

Текст заметок лежит только в .md файлах, в sets.json он не дублируется.
Файлы открываются в любом редакторе markdown; связи между сетами в тексте
остаются в виде [[название сета]].
`

// exportSavedMeta — метаданные сохранённого сета без текста заметки.
type exportSavedMeta struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	SourceLogin string `json:"source_login"`
	SourceSlug  string `json:"source_slug"`
	Frozen      bool   `json:"frozen"`
	DateSaved   string `json:"date_saved"`
}

type exportMeta struct {
	ExportedAt string            `json:"exported_at"`
	Sets       []*db.ExportSet   `json:"sets"`
	SavedSets  []exportSavedMeta `json:"saved_sets"`
}

// ExportData — выгрузка своих данных одним архивом: заметки в .md плюс метаданные в JSON.
func ExportData(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	sets, err := db.GetSetsForExport(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось собрать сеты", err)
	}

	saved, err := db.GetSavedSets(c.Context(), user.ID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось собрать сохранённые сеты", err)
	}

	savedMeta := make([]exportSavedMeta, 0, len(saved))
	for _, item := range saved {
		savedMeta = append(savedMeta, exportSavedMeta{
			ID:          item.ID,
			Title:       item.Title,
			Description: item.Description,
			SourceLogin: item.SourceLogin,
			SourceSlug:  item.SourceSlug,
			Frozen:      item.Frozen,
			DateSaved:   item.DateSaved,
		})
	}

	fileName := fmt.Sprintf("mindset-export-%s.zip", time.Now().Format("2006-01-02"))
	c.Set(fiber.HeaderContentType, "application/zip")
	c.Set(fiber.HeaderContentDisposition, `attachment; filename="`+fileName+`"`)

	// Архив собираем потоком, целиком в память не тянем.
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		archive := zip.NewWriter(w)

		write := func(name, content string) {
			entry, err := archive.Create(name)
			if err != nil {
				return
			}
			_, _ = entry.Write([]byte(content))
		}

		write("README.txt", exportReadme)

		for index, set := range sets {
			write(fmt.Sprintf("sets/%02d-%s.md", index+1, exportFileName(set.Slug, set.Title, set.ID)), set.Content)
		}
		for index, item := range saved {
			write(fmt.Sprintf("saved/%02d-%s.md", index+1, exportFileName(item.SourceSlug, item.Title, item.ID)), item.Content)
		}

		meta, err := json.MarshalIndent(exportMeta{
			ExportedAt: time.Now().UTC().Format(time.RFC3339),
			Sets:       sets,
			SavedSets:  savedMeta,
		}, "", "  ")
		if err == nil {
			write("sets.json", string(meta)+"\n")
		}

		_ = archive.Close()
		_ = w.Flush()
	})

	return nil
}

// exportFileName — имя файла в архиве: слаг (или название), очищенный до безопасных
// символов, плюс id, чтобы имена не совпадали.
func exportFileName(slug, title string, id int) string {
	name := strings.TrimSpace(slug)
	if name == "" {
		name = strings.TrimSpace(title)
	}

	cleaned := strings.Map(func(r rune) rune {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r), r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, name)

	parts := make([]string, 0, 8)
	for _, part := range strings.FieldsFunc(cleaned, func(r rune) bool { return r == '-' }) {
		parts = append(parts, part)
	}
	cleaned = strings.Join(parts, "-")

	if cleaned == "" {
		cleaned = "set"
	}
	if runes := []rune(cleaned); len(runes) > 60 {
		cleaned = string(runes[:60])
	}

	return fmt.Sprintf("%s-%d", cleaned, id)
}
