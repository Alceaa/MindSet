import { THEME_VARIABLE_NAMES } from "./theme.packages";
import { APP_THEMES, themeByKey } from "./app.themes";

/**
 * Тема пользователя — это не 52 переменные, а восемь понятных цветов. Остальные значения
 * выводятся из них (смешением и прозрачностью), поэтому «сломать» тему почти невозможно:
 * нельзя задать конфликтующие цвета, если задаёшь восемь.
 *
 * Роли:
 *   canvas   — фон страницы
 *   surface  — карточки и панели
 *   text     — основной текст
 *   border   — границы и разделители
 *   accent   — главный цвет: кнопки, ссылки, выделение
 *   danger   — опасное действие: удаление, ошибки
 *   warning  — предупреждение
 *   success  — подтверждение: галочки, «сохранено»
 */
export const THEME_ROLES = [
    {
        key: "canvas",
        label: "Фон страницы",
        hint: "Общий фон приложения",
        fallback: "#0d0f14",
    },
    {
        key: "surface",
        label: "Карточки и панели",
        hint: "Поверхности, на которых лежит текст",
        fallback: "#151821",
    },
    {
        key: "text",
        label: "Основной текст",
        hint: "Заголовки и текст заметок",
        fallback: "#ece7dc",
    },
    {
        key: "border",
        label: "Границы",
        hint: "Рамки карточек, разделители",
        fallback: "#262a35",
    },
    {
        key: "accent",
        label: "Главный цвет",
        hint: "Им подсвечены кнопки, ссылки и выделение",
        fallback: "#e2b053",
    },
    {
        key: "danger",
        label: "Опасное действие",
        hint: "Удаление и сообщения об ошибках",
        fallback: "#f0655f",
    },
    {
        key: "warning",
        label: "Предупреждение",
        hint: "«Не сохранено», «Проверьте поле»",
        fallback: "#e0913f",
    },
    {
        key: "success",
        label: "Подтверждение",
        hint: "Галочки и «сохранено»",
        fallback: "#57c469",
    },
];

export const THEME_ROLE_KEYS = THEME_ROLES.map((role) => role.key);

// Ключ своей темы в реестре приложения: registerThemePackages добавляет префикс custom:.
export const LOCAL_THEME_KEY = "custom:local";

// Готовые наборы: выбираешь пресет и правишь пару цветов, а не собираешь тему с нуля.
export const THEME_PRESETS = [
    {
        key: "graphite",
        title: "Графит",
        mode: "dark",
        base: "dark",
        roles: {
            canvas: "#101216",
            surface: "#181c22",
            text: "#e8eaee",
            border: "#2a2f38",
            accent: "#9db4d0",
            danger: "#e07a7a",
            warning: "#d8b06a",
            success: "#86c9a2",
        },
    },
    {
        key: "sea",
        title: "Море",
        mode: "dark",
        base: "dark",
        roles: {
            canvas: "#0a1a24",
            surface: "#10293a",
            text: "#dff0f5",
            border: "#1c4356",
            accent: "#5fc4d8",
            danger: "#e8888d",
            warning: "#e0c07a",
            success: "#7fd0b6",
        },
    },
    {
        key: "forest",
        title: "Лес",
        mode: "dark",
        base: "dark",
        roles: {
            canvas: "#111713",
            surface: "#1a231c",
            text: "#e3eae3",
            border: "#2f4033",
            accent: "#8dbb91",
            danger: "#d98282",
            warning: "#d8b77b",
            success: "#91c49a",
        },
    },
    {
        key: "plum",
        title: "Слива",
        mode: "dark",
        base: "dark",
        roles: {
            canvas: "#150f1d",
            surface: "#1e1630",
            text: "#ebe5f5",
            border: "#352b49",
            accent: "#b58cff",
            danger: "#e2818f",
            warning: "#dfb268",
            success: "#7ecb9d",
        },
    },
    {
        key: "dawn",
        title: "Рассвет",
        mode: "light",
        base: "light",
        roles: {
            canvas: "#fdf2ea",
            surface: "#fffaf5",
            text: "#3a2b23",
            border: "#e8d5c6",
            accent: "#b04a1e",
            danger: "#a63b2c",
            warning: "#8f6a1e",
            success: "#3f7a45",
        },
    },
];

const HEX = /^#([0-9a-f]{6})$/i;

export const isRoleColor = (value) => HEX.test(String(value ?? "").trim());

const toRgb = (hex) => {
    const value = String(hex).trim();
    return [
        parseInt(value.slice(1, 3), 16),
        parseInt(value.slice(3, 5), 16),
        parseInt(value.slice(5, 7), 16),
    ];
};

const toHex = (rgb) =>
    `#${rgb
        .map((channel) =>
            Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, "0")
        )
        .join("")}`;

// Смешиваем два цвета: weight — доля второго.
export const mix = (from, to, weight) => {
    const [r1, g1, b1] = toRgb(from);
    const [r2, g2, b2] = toRgb(to);
    const ratio = Math.min(1, Math.max(0, weight));

    return toHex([r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio]);
};

export const withAlpha = (hex, alpha) => {
    const [r, g, b] = toRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const relativeLuminance = (hex) => {
    const channels = toRgb(hex).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

// Контраст по WCAG: от 1 (одинаковые цвета) до 21 (чёрный на белом).
export const contrastRatio = (first, second) => {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    const light = Math.max(a, b);
    const dark = Math.min(a, b);

    return (light + 0.05) / (dark + 0.05);
};

// Текст «наоборот» — для надписей на цветной кнопке: берём тот из двух,
// который даёт больший контраст (порог по яркости тут ошибается на средних цветах).
export const contrastText = (hex) => {
    const dark = "#111311";
    const light = "#f7f9f7";

    return contrastRatio(hex, dark) >= contrastRatio(hex, light) ? dark : light;
};

const MIN_TEXT = 4.5;
const MIN_LARGE = 3;
// Границы — декор: ловим только совсем невидимые, иначе светлые темы предупреждали бы зря.
const MIN_LINE = 1.15;

/**
 * Предупреждения о контрасте. Сохранение не блокируем (так договорились): показываем
 * список мест, где текст или границы будут плохо читаться.
 */
export const contrastWarnings = (roles) => {
    const warnings = [];

    const check = (label, first, second, min) => {
        if (!isRoleColor(first) || !isRoleColor(second)) {
            return;
        }

        const ratio = contrastRatio(first, second);
        if (ratio < min) {
            warnings.push({
                label,
                ratio: Math.round(ratio * 100) / 100,
                min,
                text: `${label}: контраст ${Math.round(ratio * 100) / 100} при минимуме ${min}`,
            });
        }
    };

    check("Текст на фоне страницы", roles?.text, roles?.canvas, MIN_TEXT);
    check("Текст на карточках", roles?.text, roles?.surface, MIN_TEXT);
    check("Подписи на главном цвете", contrastText(roles?.accent), roles?.accent, MIN_TEXT);
    check("Главный цвет на фоне", roles?.accent, roles?.canvas, MIN_LARGE);
    check("Границы на фоне", roles?.border, roles?.canvas, MIN_LINE);
    check("Опасный цвет на фоне", roles?.danger, roles?.canvas, MIN_LARGE);

    return warnings;
};

// За какую переменную отвечает роль: конструктор показывает по ней текущий цвет.
export const ROLE_VARIABLES = {
    canvas: "--bg-canvas",
    surface: "--bg-surface",
    text: "--text",
    border: "--border",
    accent: "--accent",
    danger: "--danger",
    warning: "--warning",
    success: "--success",
};

const rolesWithDefaults = (roles = {}) => {
    const result = {};

    THEME_ROLES.forEach((role) => {
        const value = roles[role.key];
        result[role.key] = isRoleColor(value) ? String(value).trim().toLowerCase() : role.fallback;
    });

    return result;
};

/**
 * Полный набор переменных темы: подсветку кода, цвета графа, метки коллекций и тени берём
 * из встроенной темы, а «ядро» считаем из восьми ролей.
 */
export const buildThemeVariables = (roles, baseKey) => {
    const base = (themeByKey(baseKey) ?? APP_THEMES[0]).variables;
    const colors = rolesWithDefaults(roles);

    const { canvas, surface, text, border, accent, danger, warning, success } = colors;
    const onAccent = contrastText(accent);

    const status = (color) => ({
        hover: mix(color, contrastText(color), 0.18),
        soft: withAlpha(color, 0.14),
        line: withAlpha(color, 0.4),
    });

    const dangerColors = status(danger);
    const warningColors = status(warning);
    const successColors = status(success);

    return {
        ...base,

        "--bg-canvas": canvas,
        "--bg-surface": surface,
        "--bg-surface-muted": mix(canvas, surface, 0.7),
        "--bg-surface-hover": mix(surface, text, 0.12),
        "--bg-inset": mix(canvas, "#000000", 0.25),

        "--border": border,
        "--border-muted": mix(border, canvas, 0.45),

        "--text": text,
        "--text-muted": mix(text, canvas, 0.45),
        "--text-faint": mix(text, canvas, 0.62),

        "--accent": accent,
        "--accent-hover": mix(accent, onAccent, 0.2),
        "--accent-soft": withAlpha(accent, 0.14),
        "--accent-tint": withAlpha(accent, 0.08),
        "--accent-tint-strong": withAlpha(accent, 0.14),
        "--accent-line": withAlpha(accent, 0.5),
        "--accent-line-strong": withAlpha(accent, 0.6),
        "--on-accent": onAccent,

        "--success": success,
        "--success-soft": successColors.soft,
        "--success-line": successColors.line,

        "--danger": danger,
        "--danger-hover": dangerColors.hover,
        "--danger-soft": dangerColors.soft,
        "--danger-line": dangerColors.line,

        "--warning": warning,
        "--warning-soft": warningColors.soft,
        "--warning-line": warningColors.line,

        "--overlay": withAlpha(mix(canvas, "#000000", 0.75), 0.72),
        "--header-bg": withAlpha(canvas, 0.92),

        "--code-bg": mix(canvas, "#000000", 0.35),
        "--code-text": text,
        "--code-comment": mix(text, canvas, 0.62),

        "--canvas-image": `radial-gradient(1100px 520px at 12% -10%, ${withAlpha(
            accent,
            0.07
        )}, transparent 60%), radial-gradient(900px 480px at 100% 0%, ${withAlpha(
            accent,
            0.045
        )}, transparent 55%)`,
        "--auth-glow": withAlpha(accent, 0.12),
        "--fade-shadow": withAlpha(mix(canvas, "#000000", 0.9), 0.55),
    };
};

// Переменные для пакета темы сообщества: сервер принимает только белый список, поэтому
// отдаём туда лишь его — производные значения (тени, фон-градиент) и так берутся из базовой темы.
export const packageVariables = (roles, baseKey) => {
    const variables = buildThemeVariables(roles, baseKey);
    const filtered = {};

    THEME_VARIABLE_NAMES.forEach((name) => {
        if (variables[name]) {
            filtered[name] = variables[name];
        }
    });

    return filtered;
};

// Обратный ход: из переменных темы достаём роли — нужно, когда автор снова открывает тему.
export const rolesFromVariables = (variables = {}) => {
    const roles = {};

    THEME_ROLES.forEach((role) => {
        const value = variables[ROLE_VARIABLES[role.key]];
        roles[role.key] = isRoleColor(value) ? String(value).trim().toLowerCase() : role.fallback;
    });

    return roles;
};

// Тема из профиля → запись для реестра тем приложения.
export const localThemePackage = (theme) => ({
    key: "local",
    title: theme?.title?.trim() || "Своя тема",
    description: "Своя тема: восемь цветов поверх одной из встроенных",
    mode: theme?.mode === "light" ? "light" : "dark",
    base: theme?.base || "dark",
    variables: buildThemeVariables(theme?.roles, theme?.base),
});
