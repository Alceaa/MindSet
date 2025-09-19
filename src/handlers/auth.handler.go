package handlers

import (
	"fmt"
	"mindset/db"
	"mindset/models"
	"mindset/utils"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func Register(c *fiber.Ctx) error {

	var req *models.RegisterReg

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": err.Error()})
	}

	errors := utils.ValidateStruct(req)
	if errors != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "errors": errors})
	}

	if req.Password != req.PasswordConfirm {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Пароли не совпадают"})
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Ошибка сервера, пожалуйста, повторите позже", "dev": err.Error()})
	}

	newUser := models.User{
		Login:      req.Login,
		Email:      strings.ToLower(req.Email),
		Password:   string(hashedPassword),
		DateJoined: time.Now().Format(time.DateTime),
	}
	user, err := db.CreateUser(c.Context(), &newUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "fail", "dev": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "successful", "message": "Пользователь успешно создан", "user": user})
}

func Login(c *fiber.Ctx) error {

	var req *models.LoginReg

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": err})
	}

	errors := utils.ValidateStruct(req)
	if errors != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "errors": errors})
	}

	var user *models.User
	if strings.Contains(req.Login, "@") {
		user, err := db.GetUserByEmail(c.Context(), req.Login, user)
		if user == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Пользователь с такой почтой не найден", "dev": err})
		}
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Ошибка сервера, пожалуйста, повторите позже", "dev": err})
		}
	} else {
		user, err := db.GetUserByUsername(c.Context(), req.Login, user)
		if user == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Пользователь с таким именем не найден", "dev": err})
		}
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Ошибка сервера, пожалуйста, повторите позже", "dev": err})
		}
	}

	if !utils.CheckPasswordHash(req.Password, user.Password) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Пароль неверный"})
	}

	accessToken, err := utils.CreateAccessToken(user)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Ошибка сервера, пожалуйста, повторите позже", "dev": err})
	}

	refreshToken, err := utils.CreateRefreshToken(user)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "fail", "message": "Ошибка сервера, пожалуйста, повторите позже", "dev": err})
	}

	config, _ := utils.LoadEnv(".")
	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   config.JwtMaxAge * 60,
		Secure:   true,
		HTTPOnly: true,
		Domain:   "localhost",
	})
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   config.JwtMaxAge * 60,
		Secure:   true,
		HTTPOnly: true,
		Domain:   "localhost",
	})
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "access_token": accessToken, "refresh_token": refreshToken})
}

func Logout(c *fiber.Ctx) error {
	expired := time.Now().Add(-time.Hour * 24)
	c.Cookie(&fiber.Cookie{
		Name:    "access_token",
		Value:   "",
		Expires: expired,
	})
	c.Cookie(&fiber.Cookie{
		Name:    "refresh_token",
		Value:   "",
		Expires: expired,
	})
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success"})
}

func Refresh(c *fiber.Ctx) error {
	userInterface := c.Locals("user")
	user, ok := userInterface.(*models.User)
	if !ok {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"status": "fail", "message": fmt.Sprintf("context error")})
	}

	newAccessToken, err := utils.CreateAccessToken(user)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"status": "fail", "message": fmt.Sprintf("generating JWT Token failed: %v", err)})
	}

	newRefreshToken, err := utils.CreateRefreshToken(user)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"status": "fail", "message": fmt.Sprintf("generating Refresh Token failed: %v", err)})
	}

	config, _ := utils.LoadEnv(".")
	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:     "/",
		MaxAge:   config.JwtMaxAge * 60,
		Secure:   true,
		HTTPOnly: true,
		Domain:   "localhost",
	})
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		Path:     "/",
		MaxAge:   config.JwtMaxAge * 60,
		Secure:   true,
		HTTPOnly: true,
		Domain:   "localhost",
	})
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "access_token": newAccessToken, "refresh_token": newRefreshToken})

}
