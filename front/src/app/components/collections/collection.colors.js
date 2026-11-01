// Палитра меток. Имена совпадают с backend (models.CollectionColors):
// в базу попадает имя, а оттенок задаёт тема, чтобы светлая тема задавала свои цвета.
export const COLLECTION_COLORS = [
    { value: "", label: "без цвета" },
    { value: "amber", label: "янтарный" },
    { value: "blue", label: "синий" },
    { value: "green", label: "зелёный" },
    { value: "purple", label: "сиреневый" },
    { value: "red", label: "красный" },
    { value: "teal", label: "бирюзовый" },
];

export const collectionColorLabel = (value) =>
    COLLECTION_COLORS.find((item) => item.value === (value ?? ""))?.label ?? "без цвета";
