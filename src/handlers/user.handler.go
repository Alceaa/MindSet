package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"mindset/db"
	"mindset/middlewares"
	"mindset/models"
	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

const (
	avatarMaxBytes     = 2 * 1024 * 1024
	profilePageSize    = 12
	profileMaxPageSize = 50
	uploadsRoot        = "uploads"
	avatarsSubdir      = "avatars"
	mediaPrefix        = "/media"
)

func Me(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"user": user.Public()})
}

func GetPublicProfile(c *fiber.Ctx) error {
	login := strings.TrimSpace(c.Params("login"))
	if login == "" {
		return utils.Fail(c, fiber.StatusNotFound, "Профиль не найден", nil)
	}

	profile, err := db.GetProfileByLogin(c.Context(), login)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Профиль не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить профиль", err)
	}

	viewerID := 0
	if viewer, ok := middlewares.CurrentUser(c); ok {
		viewerID = viewer.ID
		profile.IsSelf = viewer.ID == profile.ID
		if !profile.IsSelf {
			following, followErr := db.IsFollowing(c.Context(), viewer.ID, profile.ID)
			if followErr != nil {
				return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось проверить подписку", followErr)
			}
			profile.IsFollowing = following
		}
	}

	bioLinks, err := db.ResolveBioLinks(c.Context(), profile.ID, viewerID, profile.Bio)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось обработать ссылки профиля", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"profile":   profile,
		"bio_links": bioLinks,
	})
}

func GetPublicUserSets(c *fiber.Ctx) error {
	login := strings.TrimSpace(c.Params("login"))
	if login == "" {
		return utils.Fail(c, fiber.StatusNotFound, "Профиль не найден", nil)
	}

	profile, err := db.GetProfileByLogin(c.Context(), login)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Профиль не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить профиль", err)
	}

	sort := strings.TrimSpace(c.Query("sort"))
	if sort != "popular" {
		sort = "recent"
	}

	limit := c.QueryInt("limit", profilePageSize)
	offset := c.QueryInt("offset", 0)
	if limit <= 0 || limit > profileMaxPageSize {
		limit = profilePageSize
	}
	if offset < 0 {
		offset = 0
	}

	viewerID := 0
	if viewer, ok := middlewares.CurrentUser(c); ok {
		viewerID = viewer.ID
	}

	sets, total, err := db.GetPublicSetsByUser(c.Context(), profile.ID, viewerID, sort, limit, offset)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось загрузить сеты профиля", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"sets":     sets,
		"sort":     sort,
		"limit":    limit,
		"offset":   offset,
		"total":    total,
		"has_more": offset+len(sets) < total,
	})
}

func UpdateMe(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.UpdateProfilePayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	updated, err := db.UpdateUserBio(c.Context(), user.ID, strings.TrimSpace(req.Bio))
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить профиль", err)
	}

	if req.RemoveAvatar && updated.Avatar != "" {
		removeAvatarFiles(user.ID)
		updated, err = db.SetUserAvatar(c.Context(), user.ID, "")
		if err != nil {
			return utils.Fail(c, fiber.StatusInternalServerError, "Биография сохранена, но аватар не удалился", err)
		}
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Профиль обновлён",
		"user":    updated.Public(),
	})
}

func UploadAvatar(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	fileHeader, err := c.FormFile("avatar")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Файл аватара не найден", err)
	}
	if fileHeader.Size <= 0 || fileHeader.Size > avatarMaxBytes {
		return utils.Fail(c, fiber.StatusRequestEntityTooLarge, "Аватар должен быть не больше 2 МБ", nil)
	}

	src, err := fileHeader.Open()
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось прочитать файл", err)
	}
	defer src.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(src, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось прочитать файл", err)
	}

	ext := avatarExtFor(http.DetectContentType(head[:n]))
	if ext == "" {
		return utils.Fail(c, fiber.StatusUnsupportedMediaType, "Поддерживаются только PNG, JPEG, GIF и WebP", nil)
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось обработать файл", err)
	}

	dir := avatarStorageDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось подготовить хранилище", err)
	}

	removeAvatarFiles(user.ID)

	filename := fmt.Sprintf("%d%s", user.ID, ext)
	dstPath := filepath.Join(dir, filename)
	dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить аватар", err)
	}
	if _, err := io.Copy(dst, io.LimitReader(src, avatarMaxBytes)); err != nil {
		dst.Close()
		_ = os.Remove(dstPath)
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить аватар", err)
	}
	if err := dst.Close(); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить аватар", err)
	}

	avatarURL := mediaPrefix + "/" + avatarsSubdir + "/" + filename
	updated, err := db.SetUserAvatar(c.Context(), user.ID, avatarURL)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Аватар сохранён, но профиль не обновился", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": "Аватар обновлён",
		"user":    updated.Public(),
		"avatar":  avatarURL,
	})
}

func Follow(c *fiber.Ctx) error {
	viewer, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	targetID, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор пользователя", err)
	}
	if targetID == viewer.ID {
		return utils.Fail(c, fiber.StatusBadRequest, "Нельзя подписаться на самого себя", nil)
	}
	if _, err := db.GetUserById(c.Context(), targetID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return utils.Fail(c, fiber.StatusNotFound, "Пользователь не найден", nil)
		}
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось проверить пользователя", err)
	}

	if err := db.FollowUser(c.Context(), viewer.ID, targetID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось подписаться", err)
	}

	return writeFollowState(c, targetID, true)
}

func Unfollow(c *fiber.Ctx) error {
	viewer, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	targetID, err := c.ParamsInt("id")
	if err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный идентификатор пользователя", err)
	}
	if targetID == viewer.ID {
		return utils.Fail(c, fiber.StatusBadRequest, "Нельзя отписаться от самого себя", nil)
	}

	if err := db.UnfollowUser(c.Context(), viewer.ID, targetID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось отписаться", err)
	}

	return writeFollowState(c, targetID, false)
}

func writeFollowState(c *fiber.Ctx, targetID int, following bool) error {
	followers, followingCount, err := db.FollowCounts(c.Context(), targetID)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Подписка обновлена, но счётчики не загрузились", err)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"is_following":    following,
		"followers_count": followers,
		"following_count": followingCount,
	})
}

func ChangePassword(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.ChangePasswordPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	if !utils.CheckPasswordHash(req.CurrentPassword, user.Password) {
		return utils.Fail(c, fiber.StatusBadRequest, "Неверный текущий пароль", nil)
	}

	hashed, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось сохранить пароль", err)
	}
	if err := db.UpdatePassword(c.Context(), user.ID, hashed); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось обновить пароль", err)
	}

	if err := db.BumpTokenEpoch(c.Context(), user.ID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Пароль изменён, но сессии не сброшены", err)
	}

	if fresh, freshErr := db.GetUserById(c.Context(), user.ID); freshErr == nil {
		_ = issueTokens(c, fresh)
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Пароль изменён"})
}

func UpdateTwoFactor(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	var req models.TwoFactorPayload
	if err := c.BodyParser(&req); err != nil {
		return utils.Fail(c, fiber.StatusBadRequest, "Некорректный формат запроса", err)
	}
	if validationErrors := utils.ValidateStruct(req); validationErrors != nil {
		return utils.FailValidation(c, validationErrors)
	}

	if !utils.CheckPasswordHash(req.Password, user.Password) {
		return utils.Fail(c, fiber.StatusBadRequest, "Неверный пароль", nil)
	}

	if req.Enabled && !user.EmailVerified {
		return utils.Fail(c, fiber.StatusConflict, "Сначала подтвердите почту", nil)
	}

	updated, err := db.SetTwoFactorEmail(c.Context(), user.ID, req.Enabled)
	if err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось изменить настройку", err)
	}

	message := "Вход по коду выключен"
	if req.Enabled {
		message = "Вход по коду включён: при следующем входе понадобится код из письма"
	}

	return utils.Success(c, fiber.StatusOK, fiber.Map{
		"message": message,
		"user":    updated.Public(),
	})
}

func LogoutAll(c *fiber.Ctx) error {
	user, ok := middlewares.CurrentUser(c)
	if !ok {
		return utils.Fail(c, fiber.StatusUnauthorized, "Требуется авторизация", nil)
	}

	if err := db.BumpTokenEpoch(c.Context(), user.ID); err != nil {
		return utils.Fail(c, fiber.StatusInternalServerError, "Не удалось завершить сессии", err)
	}

	utils.ClearAuthCookies(c)

	return utils.Success(c, fiber.StatusOK, fiber.Map{"message": "Вы вышли на всех устройствах"})
}

func avatarStorageDir() string {
	return filepath.Join(uploadsRoot, avatarsSubdir)
}

func avatarExtFor(contentType string) string {
	switch contentType {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ""
	}
}

func removeAvatarFiles(userID int) {
	matches, err := filepath.Glob(filepath.Join(avatarStorageDir(), fmt.Sprintf("%d.*", userID)))
	if err != nil {
		return
	}
	for _, path := range matches {
		_ = os.Remove(path)
	}
}
