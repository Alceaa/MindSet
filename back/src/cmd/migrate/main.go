package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"mindset/utils"

	"github.com/jackc/pgx/v5"
)

const schemaFileName = "schema.sql"

func main() {
	cfg := utils.Config()
	if err := utils.ConfigErr(); err != nil {
		log.Fatalf("Ошибка конфигурации: %v", err)
	}

	path, err := findSchema()
	if err != nil {
		log.Fatal(err)
	}

	schema, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("Не удалось прочитать %s: %v", path, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, cfg.DBUrl)
	if err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, string(schema)); err != nil {
		log.Fatalf("Не удалось применить схему: %v", err)
	}

	log.Printf("Схема применена: %s", path)
}

func findSchema() (string, error) {
	candidates := []string{
		filepath.Join("db", schemaFileName),
		filepath.Join("src", "db", schemaFileName),
	}

	if executable, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(executable)
		candidates = append(candidates,
			filepath.Join(exeDir, "db", schemaFileName),
			filepath.Join(exeDir, "src", "db", schemaFileName),
		)
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("не найден %s: запускайте команду из каталога back/src", schemaFileName)
}
