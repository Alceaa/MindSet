export const CUSTOM_THEME_PREFIX = "custom:";

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{2,31}$/;
const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_PATTERN = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0\.[0-9]{1,4}))?\s*\)$/;

export const THEME_VARIABLE_GROUPS = [
    {
        key: "background",
        title: "Фон и поверхности",
        variables: [
            { name: "--bg-canvas", label: "Фон страницы" },
            { name: "--bg-surface", label: "Карточки и панели" },
            { name: "--bg-surface-muted", label: "Приглушённые блоки" },
            { name: "--bg-surface-hover", label: "Наведение" },
            { name: "--bg-inset", label: "Углублённые блоки" },
        ],
    },
    {
        key: "borders",
        title: "Рамки",
        variables: [
            { name: "--border", label: "Рамки" },
            { name: "--border-muted", label: "Слабые рамки" },
        ],
    },
    {
        key: "text",
        title: "Текст",
        variables: [
            { name: "--text", label: "Основной текст" },
            { name: "--text-muted", label: "Второстепенный текст" },
            { name: "--text-faint", label: "Подписи и метки" },
        ],
    },
    {
        key: "accent",
        title: "Акцент",
        variables: [
            { name: "--accent", label: "Акцент" },
            { name: "--accent-hover", label: "Акцент при наведении" },
            { name: "--accent-soft", label: "Мягкая заливка" },
            { name: "--accent-tint", label: "Лёгкая подсветка" },
            { name: "--accent-tint-strong", label: "Подсветка сильнее" },
            { name: "--accent-line", label: "Линия акцента" },
            { name: "--accent-line-strong", label: "Линия акцента ярче" },
            { name: "--on-accent", label: "Текст на акценте" },
        ],
    },
    {
        key: "statuses",
        title: "Статусы",
        variables: [
            { name: "--success", label: "Успех" },
            { name: "--success-soft", label: "Успех: заливка" },
            { name: "--success-line", label: "Успех: рамка" },
            { name: "--danger", label: "Ошибка" },
            { name: "--danger-hover", label: "Ошибка при наведении" },
            { name: "--danger-soft", label: "Ошибка: заливка" },
            { name: "--danger-line", label: "Ошибка: рамка" },
            { name: "--warning", label: "Предупреждение" },
            { name: "--warning-soft", label: "Предупреждение: заливка" },
            { name: "--warning-line", label: "Предупреждение: рамка" },
        ],
    },
    {
        key: "chrome",
        title: "Интерфейс",
        variables: [
            { name: "--overlay", label: "Затемнение поверх страницы" },
            { name: "--header-bg", label: "Шапка" },
        ],
    },
    {
        key: "code",
        title: "Блоки кода",
        variables: [
            { name: "--code-bg", label: "Фон кода" },
            { name: "--code-text", label: "Текст кода" },
            { name: "--code-comment", label: "Комментарии" },
            { name: "--code-keyword", label: "Ключевые слова" },
            { name: "--code-string", label: "Строки" },
            { name: "--code-number", label: "Числа" },
        ],
    },
    {
        key: "graph",
        title: "Граф связей",
        variables: [
            { name: "--graph-edge", label: "Связи" },
            { name: "--graph-edge-soft", label: "Слабые связи" },
            { name: "--graph-arrow", label: "Стрелки" },
            { name: "--graph-frozen", label: "Замороженные" },
            { name: "--graph-frozen-soft", label: "Замороженные: заливка" },
            { name: "--graph-deleted", label: "Удалённые" },
            { name: "--graph-deleted-soft", label: "Удалённые: заливка" },
            { name: "--graph-neighbor", label: "Соседи" },
        ],
    },
    {
        key: "collections",
        title: "Метки коллекций",
        variables: [
            { name: "--collection-amber", label: "Янтарная" },
            { name: "--collection-blue", label: "Синяя" },
            { name: "--collection-green", label: "Зелёная" },
            { name: "--collection-purple", label: "Лиловая" },
            { name: "--collection-red", label: "Красная" },
            { name: "--collection-teal", label: "Бирюзовая" },
        ],
    },
    {
        key: "other",
        title: "Прочее",
        variables: [
            { name: "--auth-glow", label: "Свечение на экране входа" },
            { name: "--fade-shadow", label: "Тень прокрутки" },
        ],
    },
];

export const THEME_VARIABLE_NAMES = THEME_VARIABLE_GROUPS.flatMap((group) =>
    group.variables.map((item) => item.name)
);

export const themeVariableLabel = (name) => {
    for (const group of THEME_VARIABLE_GROUPS) {
        const found = group.variables.find((item) => item.name === name);
        if (found) {
            return found.label;
        }
    }
    return name;
};

export const validThemeKey = (value) => KEY_PATTERN.test(String(value ?? "").trim());

export const validThemeColor = (value) => {
    const trimmed = String(value ?? "").trim();
    return HEX_PATTERN.test(trimmed) || RGBA_PATTERN.test(trimmed);
};

export const isHexColor = (value) => HEX_PATTERN.test(String(value ?? "").trim());

export const colorPreview = (value) =>
    validThemeColor(value) ? String(value).trim() : "transparent";
