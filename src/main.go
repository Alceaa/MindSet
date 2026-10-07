package main

import (
	"errors"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"mindset/db"
	"mindset/handlers"
	"mindset/middlewares"
	"mindset/routes"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	cfg := utils.Config()
	if err := utils.ConfigErr(); err != nil {
		log.Fatalf("Ошибка конфигурации: %v", err)
	}

	if err := db.Open(cfg.DBUrl); err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}
	defer db.Close()

	app := fiber.New(fiber.Config{
		AppName:      "MindSet API",
		BodyLimit:    4 * 1024 * 1024,
		UnescapePath: true,
		ErrorHandler: jsonErrorHandler,
	})

	app.Use(recover.New())

	app.Use(logger.New(logger.Config{
		Format:     "${time} ${status} ${latency} ${method} ${path}\n",
		TimeFormat: "15:04:05",
	}))

	app.Use(cors.New(cors.Config{
		AllowOrigins: strings.Join(corsOrigins(cfg), ","),
		AllowMethods: strings.Join([]string{
			fiber.MethodGet,
			fiber.MethodPost,
			fiber.MethodPut,
			fiber.MethodPatch,
			fiber.MethodDelete,
			fiber.MethodOptions,
		}, ","),
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	app.Use(middlewares.RequireJSONBody)

	app.Get("/health", handlers.Health)
	routes.SetupRoutes(app)
	app.Static("/media", "./uploads")

	go waitForShutdown(app)

	log.Printf("Сервер запущен на %s (окружение: %s)", cfg.Address(), cfg.Env)
	if err := app.Listen(cfg.Address()); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}

func corsOrigins(cfg utils.Env) []string {
	origins := cfg.Origins()
	if len(origins) > 0 {
		return origins
	}
	return []string{"http://localhost:3000"}
}

func waitForShutdown(app *fiber.App) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	<-signals

	log.Print("Завершение работы сервера...")
	if err := app.ShutdownWithTimeout(5 * time.Second); err != nil {
		log.Printf("Не удалось корректно остановить сервер: %v", err)
	}
}

func jsonErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Внутренняя ошибка сервера"

	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		code = fiberErr.Code
	}

	switch code {
	case fiber.StatusNotFound:
		message = "Маршрут не найден"
	case fiber.StatusMethodNotAllowed:
		message = "Метод не поддерживается"
	case fiber.StatusRequestEntityTooLarge:
		message = "Слишком большой запрос"
	case fiber.StatusUnsupportedMediaType:
		message = "Неподдерживаемый формат данных"
	}

	if code >= fiber.StatusInternalServerError {
		return utils.Fail(c, code, message, err)
	}
	return c.Status(code).JSON(fiber.Map{"status": "fail", "message": message})
}
