package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"mindset/db"
	"mindset/models"
	"mindset/utils"
)

func usage() {
	fmt.Println("использование:")
	fmt.Println("  admin list              — список пользователей")
	fmt.Println("  admin promote <login>   — выдать роль администратора")
	fmt.Println("  admin demote <login>    — снять роль администратора")
	fmt.Println("  admin block <login>     — заблокировать пользователя")
	fmt.Println("  admin unblock <login>   — разблокировать пользователя")
	os.Exit(1)
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}

	action := os.Args[1]

	cfg := utils.Config()
	if err := db.Open(cfg.DBUrl); err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	if action == "list" {
		users, err := db.ListAdminUsers(ctx, "", false, 100, 0)
		if err != nil {
			log.Fatalf("Не удалось получить список: %v", err)
		}

		fmt.Printf("%-4s %-26s %-32s %-6s %-12s %s\n", "id", "логин", "почта", "роль", "статус", "сетов")
		for _, user := range users {
			status := "активен"
			if user.Blocked {
				status = "заблокирован"
			}
			fmt.Printf("%-4d %-26s %-32s %-6s %-12s %d\n",
				user.ID, user.Login, user.Email, user.Role, status, user.SetCount)
		}
		return
	}

	if len(os.Args) < 3 {
		usage()
	}
	login := os.Args[2]

	user, err := db.GetUserByLogin(ctx, login)
	if err != nil {
		log.Fatalf("Пользователь %s не найден: %v", login, err)
	}

	switch action {
	case "promote":
		updated, err := db.SetUserRole(ctx, user.ID, models.RoleAdmin)
		if err != nil {
			log.Fatalf("Не удалось выдать роль: %v", err)
		}
		fmt.Printf("Пользователь %s теперь администратор\n", updated.Login)
	case "demote":
		if _, err := db.SetUserRole(ctx, user.ID, models.RoleUser); err != nil {
			log.Fatalf("Не удалось снять роль: %v", err)
		}
		fmt.Printf("Пользователь %s больше не администратор\n", user.Login)
	case "block", "unblock":
		blocked := action == "block"
		if _, err := db.SetUserBlocked(ctx, user.ID, blocked, "", 0); err != nil {
			log.Fatalf("Не удалось изменить блокировку: %v", err)
		}
		state := "разблокирован"
		if blocked {
			state = "заблокирован"
		}
		fmt.Printf("Пользователь %s %s\n", user.Login, state)
	default:
		usage()
	}
}
