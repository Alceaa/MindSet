package models

import "encoding/json"

// Board — доска (whiteboard). Содержимое хранится как есть: сцена Excalidraw
// в формате .excalidraw (elements + appState), поэтому в базу идёт jsonb.
// Если доски станут слишком тяжёлыми, doc переедет в S3, а здесь останется ключ.
type Board struct {
	ID         int             `json:"id"`
	Title      string          `json:"title"`
	Visibility Visibility      `json:"visibility"`
	Doc        json.RawMessage `json:"doc,omitempty"`
	CreatedAt  string          `json:"created_at,omitempty"`
	UpdatedAt  string          `json:"updated_at,omitempty"`
}

// BoardListItem — доска в списке: без сцены, чтобы список не тянул мегабайты.
type BoardListItem struct {
	ID        int        `json:"id"`
	Title     string     `json:"title"`
	Visibility Visibility `json:"visibility"`
	CreatedAt string     `json:"created_at,omitempty"`
	UpdatedAt string     `json:"updated_at,omitempty"`
}

// BoardPayload — создание и переименование доски.
type BoardPayload struct {
	Title      string     `json:"title" validate:"required,min=1,max=80"`
	Visibility Visibility `json:"visibility" validate:"omitempty,oneof=private unlisted public"`
	Doc        any        `json:"doc,omitempty"`
}

// BoardDocPayload — автосохранение сцены: приходит часто, поэтому отдельным запросом.
type BoardDocPayload struct {
	Doc any `json:"doc" validate:"required"`
}
