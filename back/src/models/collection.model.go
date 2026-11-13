package models

// CollectionColors — палитра меток. В базу попадает имя, оттенок задаёт тема,
// чтобы светлая тема (2.0.0, этап 2) задавала свои цвета.
var CollectionColors = []string{"", "amber", "blue", "green", "purple", "red", "teal"}

func ValidCollectionColor(color string) bool {
	for _, known := range CollectionColors {
		if known == color {
			return true
		}
	}
	return false
}

// Collection — личная полка для сетов. Вложенности нет: коллекция внутри коллекции не лежит.
type Collection struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	Color      string `json:"color"`
	Position   int    `json:"position"`
	SetsCount  int    `json:"sets_count"`
	SavedCount int    `json:"saved_count"`
}

// CollectionPayload — создание и правка коллекции.
type CollectionPayload struct {
	Title    string `json:"title" validate:"required,min=1,max=60"`
	Color    string `json:"color" validate:"omitempty,max=20"`
	Position int    `json:"position" validate:"omitempty,min=0,max=10000"`
}

// CollectionAssignPayload — назначение коллекции сету или снимку.
// collection_id = 0 означает «убрать из коллекции»: сеты без коллекции показываются в конце.
type CollectionAssignPayload struct {
	CollectionID int `json:"collection_id" validate:"min=0"`
}
