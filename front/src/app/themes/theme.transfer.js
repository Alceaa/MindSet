import { isRoleColor, THEME_PRESETS, THEME_ROLES } from "./theme.roles";
import { APP_THEMES } from "./app.themes";

// Файл темы: восемь ролей и базовая тема. Обмен идёт текстом или файлом, поэтому формат
// простой и читаемый — его можно переслать в чате, положить в заметку или сохранить файлом.
export const THEME_FILE_KIND = "mindset.theme";
export const THEME_FILE_VERSION = 1;

const BASE_KEYS = APP_THEMES.map((item) => item.key);
const DEFAULT_TITLE = "Импортированная тема";

// Имя файла собираем из названия: латиница, цифры и дефис — так файл читается в списке загрузок.
// Русские названия не транслитерируем: если в названии нет латиницы, берём ключ темы.
export const themeFileName = (title, fallbackKey) => {
    const slug = (value) =>
        String(value ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40);

    return `${slug(title) || slug(fallbackKey) || "mindset-theme"}.theme.json`;
};

// themeToFile — то, что уезжает в файл: без идентификаторов и служебных полей библиотеки.
export const themeToFile = (theme) => ({
    kind: THEME_FILE_KIND,
    version: THEME_FILE_VERSION,
    title: theme?.title ?? "",
    description: theme?.description ?? "",
    mode: theme?.mode === "light" ? "light" : "dark",
    base: BASE_KEYS.includes(theme?.base) ? theme.base : THEME_PRESETS[0].base,
    roles: roleValues(theme?.roles),
});

export const themeFileText = (theme) => `${JSON.stringify(themeToFile(theme), null, 2)}\n`;

const roleValues = (roles) => {
    const result = {};

    THEME_ROLES.forEach((role) => {
        const value = roles?.[role.key];
        result[role.key] = isRoleColor(value) ? String(value).trim().toLowerCase() : role.fallback;
    });

    return result;
};

/**
 * parseThemeFile разбирает вставленный текст: JSON файла темы или просто объект с ролями.
 * Возвращаем либо тему для конструктора, либо понятную ошибку — импорт ничего не применяет.
 */
export const parseThemeFile = (text) => {
    const raw = String(text ?? "").trim();

    if (!raw) {
        return { ok: false, error: "Вставьте текст темы или выберите файл" };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, error: "Это не файл темы: не разобрали JSON" };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Это не файл темы: ожидали объект с ролями" };
    }

    if (parsed.kind && parsed.kind !== THEME_FILE_KIND) {
        return { ok: false, error: `Это файл «${parsed.kind}», а нужен файл темы MindSet` };
    }

    const version = Number(parsed.version ?? THEME_FILE_VERSION);
    if (!Number.isFinite(version) || version > THEME_FILE_VERSION) {
        return { ok: false, error: "Файл темы сделан более новой версией MindSet" };
    }

    const roles = parsed.roles;
    if (!roles || typeof roles !== "object" || Array.isArray(roles)) {
        return { ok: false, error: "В файле нет ролей темы" };
    }

    const unknown = Object.keys(roles).find(
        (key) => !THEME_ROLES.some((role) => role.key === key)
    );
    if (unknown) {
        return { ok: false, error: `Роль «${unknown}» в этой версии MindSet не поддерживается` };
    }

    const broken = THEME_ROLES.find((role) => roles[role.key] !== undefined && !isRoleColor(roles[role.key]));
    if (broken) {
        return { ok: false, error: `Роль «${broken.label}»: нужен цвет вида #rrggbb` };
    }

    const filled = THEME_ROLES.filter((role) => isRoleColor(roles[role.key])).length;
    if (filled === 0) {
        return { ok: false, error: "В файле нет ни одного цвета темы" };
    }

    const title = String(parsed.title ?? "").trim();

    return {
        ok: true,
        theme: {
            title,
            description: String(parsed.description ?? "").trim(),
            mode: parsed.mode === "light" ? "light" : "dark",
            base: BASE_KEYS.includes(parsed.base) ? parsed.base : THEME_PRESETS[0].base,
            roles: roleValues(roles),
        },
        // Название из файла может быть пустым: в конструкторе подставим понятное.
        suggestedTitle: title || DEFAULT_TITLE,
    };
};
