/**
 * Темы приложения — это данные, а не код: набор CSS-переменных плюс подписи.
 * Тёмная тема повторяет значения из base.scss (они нужны как запасной вариант
 * до первой отрисовки), остальные — светлая, сепия, nord и контраст — пришли
 * из прежних тем читалки и теперь оформляют всё приложение.
 *
 * mode нужен только MUI: он ждёт ровно "light" или "dark".
 *
 * Задел под плагины-темы (этап 5): новая тема — это такой же объект,
 * поэтому её можно принести данными, не трогая стили.
 */
import { CUSTOM_THEME_PREFIX, THEME_VARIABLE_NAMES, validThemeColor } from "./theme.packages";

export const APP_THEMES = [
    {
        key: "dark",
        label: "Тёмная",
        hint: "Тёмный фон, тёплый акцент",
        mode: "dark",
        variables: {
            "--bg-canvas": "#0d0f14",
            "--bg-surface": "#151821",
            "--bg-surface-muted": "#1d202b",
            "--bg-surface-hover": "#262b37",
            "--bg-inset": "#090b10",
            "--border": "#262a35",
            "--border-muted": "#1c2029",
            "--text": "#ece7dc",
            "--text-muted": "#9a948a",
            "--text-faint": "#6f6a60",
            "--accent": "#e2b053",
            "--accent-hover": "#c99a37",
            "--accent-soft": "rgba(226, 176, 83, 0.14)",
            "--accent-tint": "rgba(226, 176, 83, 0.08)",
            "--accent-tint-strong": "rgba(226, 176, 83, 0.14)",
            "--accent-line": "rgba(226, 176, 83, 0.5)",
            "--accent-line-strong": "rgba(226, 176, 83, 0.6)",
            "--on-accent": "#241a06",
            "--success": "#57c469",
            "--success-soft": "rgba(87, 196, 105, 0.12)",
            "--success-line": "rgba(87, 196, 105, 0.4)",
            "--danger": "#f0655f",
            "--danger-hover": "#d9534d",
            "--danger-soft": "rgba(240, 101, 95, 0.12)",
            "--danger-line": "rgba(240, 101, 95, 0.4)",
            "--warning": "#e0913f",
            "--warning-soft": "rgba(224, 145, 63, 0.12)",
            "--warning-line": "rgba(224, 145, 63, 0.4)",
            "--shadow": "0 12px 32px rgba(0, 0, 0, 0.45)",
            "--shadow-sm": "0 2px 10px rgba(0, 0, 0, 0.35)",
            "--overlay": "rgba(9, 11, 16, 0.72)",
            "--header-bg": "rgba(13, 17, 23, 0.85)",
            "--canvas-image":
                "radial-gradient(1100px 520px at 12% -10%, rgba(226, 176, 83, 0.07), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(226, 176, 83, 0.045), transparent 55%)",
            "--code-bg": "#090b10",
            "--code-text": "#ece7dc",
            "--code-comment": "#6f6a60",
            "--code-keyword": "#e2b053",
            "--code-string": "#8fd18a",
            "--code-number": "#e0913f",
            "--graph-edge": "#59616e",
            "--graph-edge-soft": "rgba(200, 206, 216, 0.55)",
            "--graph-arrow": "rgba(200, 206, 216, 0.75)",
            "--graph-frozen": "#5fb3a1",
            "--graph-frozen-soft": "rgba(95, 179, 161, 0.18)",
            "--graph-deleted": "#8b93a1",
            "--graph-deleted-soft": "rgba(139, 147, 161, 0.1)",
            "--graph-neighbor": "#f0cd82",
            "--collection-amber": "#e2b053",
            "--collection-blue": "#6ea8fe",
            "--collection-green": "#6cc48a",
            "--collection-purple": "#b18cff",
            "--collection-red": "#f2777a",
            "--collection-teal": "#5fc9c2",
            "--auth-glow": "rgba(226, 176, 83, 0.12)",
            "--fade-shadow": "rgba(4, 6, 10, 0.55)",
        },
    },
    {
        key: "light",
        label: "Светлая",
        hint: "Светлый фон, тёмный текст",
        mode: "light",
        variables: {
            "--bg-canvas": "#f7f5f0",
            "--bg-surface": "#ffffff",
            "--bg-surface-muted": "#f2efe8",
            "--bg-surface-hover": "#e9e4d8",
            "--bg-inset": "#eae6dd",
            "--border": "#ddd7c9",
            "--border-muted": "#e9e4d9",
            "--text": "#22201c",
            "--text-muted": "#5f5a50",
            "--text-faint": "#8a8478",
            "--accent": "#c08f2a",
            "--accent-hover": "#a87a1f",
            "--accent-soft": "rgba(192, 143, 42, 0.16)",
            "--accent-tint": "rgba(192, 143, 42, 0.1)",
            "--accent-tint-strong": "rgba(192, 143, 42, 0.18)",
            "--accent-line": "rgba(192, 143, 42, 0.45)",
            "--accent-line-strong": "rgba(192, 143, 42, 0.6)",
            "--on-accent": "#241a06",
            "--success": "#2f7d3f",
            "--success-soft": "rgba(47, 125, 63, 0.12)",
            "--success-line": "rgba(47, 125, 63, 0.4)",
            "--danger": "#b3352f",
            "--danger-hover": "#962b26",
            "--danger-soft": "rgba(179, 53, 47, 0.1)",
            "--danger-line": "rgba(179, 53, 47, 0.4)",
            "--warning": "#a2621a",
            "--warning-soft": "rgba(162, 98, 26, 0.12)",
            "--warning-line": "rgba(162, 98, 26, 0.4)",
            "--shadow": "0 12px 28px rgba(34, 32, 28, 0.14)",
            "--shadow-sm": "0 2px 8px rgba(34, 32, 28, 0.1)",
            "--overlay": "rgba(34, 32, 28, 0.35)",
            "--header-bg": "rgba(247, 245, 240, 0.88)",
            "--canvas-image":
                "radial-gradient(1100px 520px at 12% -10%, rgba(192, 143, 42, 0.08), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(192, 143, 42, 0.05), transparent 55%)",
            "--code-bg": "#eae6dd",
            "--code-text": "#22201c",
            "--code-comment": "#8a8478",
            "--code-keyword": "#a87a1f",
            "--code-string": "#2f7d3f",
            "--code-number": "#a2621a",
            "--graph-edge": "#a49c8c",
            "--graph-edge-soft": "rgba(90, 86, 76, 0.45)",
            "--graph-arrow": "rgba(90, 86, 76, 0.7)",
            "--graph-frozen": "#2f7d72",
            "--graph-frozen-soft": "rgba(47, 125, 114, 0.16)",
            "--graph-deleted": "#8a8478",
            "--graph-deleted-soft": "rgba(138, 132, 120, 0.14)",
            "--graph-neighbor": "#8c6413",
            "--collection-amber": "#b8862a",
            "--collection-blue": "#3b7dd8",
            "--collection-green": "#3f8f4f",
            "--collection-purple": "#7d5cd6",
            "--collection-red": "#cc4b4b",
            "--collection-teal": "#2f8f89",
            "--auth-glow": "rgba(192, 143, 42, 0.12)",
            "--fade-shadow": "rgba(34, 32, 28, 0.16)",
        },
    },
    {
        // Пришла из прежней темы читалки «Сепия»: тёплый бумажный фон.
        key: "sepia",
        label: "Сепия",
        hint: "Бумажный фон, коричневый акцент",
        mode: "light",
        variables: {
            "--bg-canvas": "#f1e9da",
            "--bg-surface": "#f6efe1",
            "--bg-surface-muted": "#ece1cb",
            "--bg-surface-hover": "#e6d9bf",
            "--bg-inset": "#e8dcc6",
            "--border": "#cdbf9f",
            "--border-muted": "#ded2b8",
            "--text": "#3a352c",
            "--text-muted": "#6d6454",
            "--text-faint": "#948b78",
            "--accent": "#8a5a12",
            "--accent-hover": "#744c0e",
            "--accent-soft": "rgba(138, 90, 18, 0.14)",
            "--accent-tint": "rgba(138, 90, 18, 0.08)",
            "--accent-tint-strong": "rgba(138, 90, 18, 0.14)",
            "--accent-line": "rgba(138, 90, 18, 0.45)",
            "--accent-line-strong": "rgba(138, 90, 18, 0.6)",
            "--on-accent": "#fdf3e0",
            "--success": "#3f7a3f",
            "--success-soft": "rgba(63, 122, 63, 0.12)",
            "--success-line": "rgba(63, 122, 63, 0.4)",
            "--danger": "#a63a2f",
            "--danger-hover": "#8c3027",
            "--danger-soft": "rgba(166, 58, 47, 0.1)",
            "--danger-line": "rgba(166, 58, 47, 0.4)",
            "--warning": "#9a6415",
            "--warning-soft": "rgba(154, 100, 21, 0.12)",
            "--warning-line": "rgba(154, 100, 21, 0.4)",
            "--shadow": "0 12px 28px rgba(58, 53, 44, 0.16)",
            "--shadow-sm": "0 2px 8px rgba(58, 53, 44, 0.12)",
            "--overlay": "rgba(58, 53, 44, 0.35)",
            "--header-bg": "rgba(246, 239, 225, 0.9)",
            "--canvas-image":
                "radial-gradient(1100px 520px at 12% -10%, rgba(138, 90, 18, 0.08), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(138, 90, 18, 0.05), transparent 55%)",
            "--code-bg": "#e8dcc6",
            "--code-text": "#3a352c",
            "--code-comment": "#948b78",
            "--code-keyword": "#8a5a12",
            "--code-string": "#3f7a3f",
            "--code-number": "#9a6415",
            "--graph-edge": "#a89a7d",
            "--graph-edge-soft": "rgba(58, 53, 44, 0.45)",
            "--graph-arrow": "rgba(58, 53, 44, 0.7)",
            "--graph-frozen": "#2f6d63",
            "--graph-frozen-soft": "rgba(47, 109, 99, 0.18)",
            "--graph-deleted": "#948b78",
            "--graph-deleted-soft": "rgba(148, 139, 120, 0.16)",
            "--graph-neighbor": "#6b4409",
            "--collection-amber": "#a5761b",
            "--collection-blue": "#3f6fa8",
            "--collection-green": "#4a7f45",
            "--collection-purple": "#7a5aa8",
            "--collection-red": "#a8443c",
            "--collection-teal": "#3d7f78",
            "--auth-glow": "rgba(138, 90, 18, 0.12)",
            "--fade-shadow": "rgba(58, 53, 44, 0.18)",
        },
    },
    {
        // Пришла из прежней темы читалки «Nord»: холодный синий, приглушённый.
        key: "nord",
        label: "Nord",
        hint: "Холодный синий, спокойный контраст",
        mode: "dark",
        variables: {
            "--bg-canvas": "#272c36",
            "--bg-surface": "#2e3440",
            "--bg-surface-muted": "#3b4252",
            "--bg-surface-hover": "#3b4252",
            "--bg-inset": "#22262e",
            "--border": "#4c566a",
            "--border-muted": "#3b4252",
            "--text": "#d8dee9",
            "--text-muted": "#a6b0c1",
            "--text-faint": "#7c8699",
            "--accent": "#88c0d0",
            "--accent-hover": "#6fa9bb",
            "--accent-soft": "rgba(136, 192, 208, 0.14)",
            "--accent-tint": "rgba(136, 192, 208, 0.08)",
            "--accent-tint-strong": "rgba(136, 192, 208, 0.14)",
            "--accent-line": "rgba(136, 192, 208, 0.5)",
            "--accent-line-strong": "rgba(136, 192, 208, 0.6)",
            "--on-accent": "#1c2027",
            "--success": "#a3be8c",
            "--success-soft": "rgba(163, 190, 140, 0.12)",
            "--success-line": "rgba(163, 190, 140, 0.4)",
            "--danger": "#bf616a",
            "--danger-hover": "#a54d56",
            "--danger-soft": "rgba(191, 97, 106, 0.12)",
            "--danger-line": "rgba(191, 97, 106, 0.4)",
            "--warning": "#ebcb8b",
            "--warning-soft": "rgba(235, 203, 139, 0.12)",
            "--warning-line": "rgba(235, 203, 139, 0.4)",
            "--shadow": "0 12px 32px rgba(0, 0, 0, 0.45)",
            "--shadow-sm": "0 2px 10px rgba(0, 0, 0, 0.35)",
            "--overlay": "rgba(20, 24, 30, 0.72)",
            "--header-bg": "rgba(46, 52, 64, 0.85)",
            "--canvas-image":
                "radial-gradient(1100px 520px at 12% -10%, rgba(136, 192, 208, 0.07), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(136, 192, 208, 0.04), transparent 55%)",
            "--code-bg": "#22262e",
            "--code-text": "#d8dee9",
            "--code-comment": "#7c8699",
            "--code-keyword": "#88c0d0",
            "--code-string": "#a3be8c",
            "--code-number": "#ebcb8b",
            "--graph-edge": "#5e6a80",
            "--graph-edge-soft": "rgba(216, 222, 233, 0.5)",
            "--graph-arrow": "rgba(216, 222, 233, 0.75)",
            "--graph-frozen": "#8fbcbb",
            "--graph-frozen-soft": "rgba(143, 188, 187, 0.2)",
            "--graph-deleted": "#7c8699",
            "--graph-deleted-soft": "rgba(124, 134, 153, 0.12)",
            "--graph-neighbor": "#ebcb8b",
            "--collection-amber": "#ebcb8b",
            "--collection-blue": "#81a1c1",
            "--collection-green": "#a3be8c",
            "--collection-purple": "#b48ead",
            "--collection-red": "#bf616a",
            "--collection-teal": "#8fbcbb",
            "--auth-glow": "rgba(136, 192, 208, 0.12)",
            "--fade-shadow": "rgba(0, 0, 0, 0.45)",
        },
    },
    {
        // Пришла из прежней темы читалки «Контраст»: чёрный фон, крупные различия.
        key: "contrast",
        label: "Контраст",
        hint: "Чёрный фон, максимальная чёткость",
        mode: "dark",
        variables: {
            "--bg-canvas": "#000000",
            "--bg-surface": "#0a0d12",
            "--bg-surface-muted": "#161b22",
            "--bg-surface-hover": "#161b22",
            "--bg-inset": "#000000",
            "--border": "#565f69",
            "--border-muted": "#3d444d",
            "--text": "#ffffff",
            "--text-muted": "#cfd6dd",
            "--text-faint": "#97a1ab",
            "--accent": "#58a6ff",
            "--accent-hover": "#3d8ce0",
            "--accent-soft": "rgba(88, 166, 255, 0.15)",
            "--accent-tint": "rgba(88, 166, 255, 0.1)",
            "--accent-tint-strong": "rgba(88, 166, 255, 0.18)",
            "--accent-line": "rgba(88, 166, 255, 0.5)",
            "--accent-line-strong": "rgba(88, 166, 255, 0.65)",
            "--on-accent": "#06121f",
            "--success": "#3fb950",
            "--success-soft": "rgba(63, 185, 80, 0.14)",
            "--success-line": "rgba(63, 185, 80, 0.45)",
            "--danger": "#f85149",
            "--danger-hover": "#d93b33",
            "--danger-soft": "rgba(248, 81, 73, 0.14)",
            "--danger-line": "rgba(248, 81, 73, 0.45)",
            "--warning": "#d29922",
            "--warning-soft": "rgba(210, 153, 34, 0.14)",
            "--warning-line": "rgba(210, 153, 34, 0.45)",
            "--shadow": "0 12px 32px rgba(0, 0, 0, 0.65)",
            "--shadow-sm": "0 2px 10px rgba(0, 0, 0, 0.5)",
            "--overlay": "rgba(0, 0, 0, 0.75)",
            "--header-bg": "rgba(0, 0, 0, 0.85)",
            "--canvas-image":
                "radial-gradient(1100px 520px at 12% -10%, rgba(88, 166, 255, 0.06), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(88, 166, 255, 0.03), transparent 55%)",
            "--code-bg": "#0d1117",
            "--code-text": "#ffffff",
            "--code-comment": "#8b949e",
            "--code-keyword": "#58a6ff",
            "--code-string": "#3fb950",
            "--code-number": "#d29922",
            "--graph-edge": "#7d8590",
            "--graph-edge-soft": "rgba(255, 255, 255, 0.55)",
            "--graph-arrow": "rgba(255, 255, 255, 0.8)",
            "--graph-frozen": "#56d4dd",
            "--graph-frozen-soft": "rgba(86, 212, 221, 0.2)",
            "--graph-deleted": "#8b949e",
            "--graph-deleted-soft": "rgba(139, 148, 158, 0.12)",
            "--graph-neighbor": "#ffd166",
            "--collection-amber": "#e2b053",
            "--collection-blue": "#58a6ff",
            "--collection-green": "#3fb950",
            "--collection-purple": "#bc8cff",
            "--collection-red": "#f85149",
            "--collection-teal": "#56d4dd",
            "--auth-glow": "rgba(88, 166, 255, 0.12)",
            "--fade-shadow": "rgba(0, 0, 0, 0.65)",
        },
    },
];

export const DEFAULT_THEME = "dark";

const CACHE_KEY = "mindset:theme:cache";
const ALLOWED_VARIABLES = new Set(THEME_VARIABLE_NAMES);

const customThemes = new Map();
let cachedThemes = null;

const readCache = () => {
    try {
        return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}");
    } catch {
        return {};
    }
};

const writeCache = (cache) => {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        cachedThemes = cache;
        return;
    }
    cachedThemes = cache;
};

const cachedTheme = (key) => {
    if (cachedThemes === null) {
        cachedThemes = readCache();
    }
    return cachedThemes[key];
};

export const customThemeFromPackage = (item) => {
    if (!item?.key) {
        return null;
    }

    const base = APP_THEMES.find((theme) => theme.key === item.base) ?? APP_THEMES[0];
    const overrides = {};

    Object.entries(item.variables ?? {}).forEach(([name, value]) => {
        if (ALLOWED_VARIABLES.has(name) && validThemeColor(value)) {
            overrides[name] = String(value).trim();
        }
    });

    if (Object.keys(overrides).length === 0) {
        return null;
    }

    return {
        key: CUSTOM_THEME_PREFIX + item.key,
        label: item.title || item.key,
        hint: item.description || `Тема из сообщества${item.author ? ` · @${item.author}` : ""}`,
        mode: item.mode === "light" ? "light" : "dark",
        variables: { ...base.variables, ...overrides },
        custom: true,
        packageKey: item.key,
    };
};

export const registerThemePackages = (packages) => {
    const cache = readCache();
    const registered = [];

    (packages ?? []).forEach((item) => {
        const theme = customThemeFromPackage(item);
        if (!theme) {
            return;
        }

        customThemes.set(theme.key, theme);
        cache[theme.key] = { variables: theme.variables, mode: theme.mode };
        registered.push(theme);
    });

    writeCache(cache);

    return registered;
};

export const registeredThemes = () => [...customThemes.values()];

export const isCustomTheme = (key) => String(key ?? "").startsWith(CUSTOM_THEME_PREFIX);

export const themeByKey = (key) => {
    const builtIn = APP_THEMES.find((item) => item.key === key);
    if (builtIn) {
        return builtIn;
    }

    const registered = customThemes.get(key);
    if (registered) {
        return registered;
    }

    const cached = cachedTheme(key);
    if (cached?.variables) {
        return {
            key,
            label: "Своя тема",
            hint: "Тема из сообщества",
            mode: cached.mode === "light" ? "light" : "dark",
            variables: cached.variables,
            custom: true,
        };
    }

    return APP_THEMES[0];
};

// MUI умеет только "light" и "dark", поэтому тема хранит режим отдельно.
export const themeMode = (key) => themeByKey(key).mode;

// Имена переменных, которые выставила предыдущая тема: чтобы от смены темы
// не оставалось хвостов, если новая тема задаёт не все переменные.
let appliedNames = [];

// Применяем тему как набор переменных на <html>: стили о теме ничего не знают.
export const applyTheme = (key) => {
    const theme = themeByKey(key);
    const root = document.documentElement;

    for (const name of appliedNames) {
        if (!(name in theme.variables)) {
            root.style.removeProperty(name);
        }
    }

    for (const [name, value] of Object.entries(theme.variables)) {
        root.style.setProperty(name, value);
    }

    appliedNames = Object.keys(theme.variables);
    root.dataset.theme = theme.key;

    root.style.colorScheme = theme.mode;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
        themeColor.setAttribute("content", theme.variables["--bg-canvas"]);
    }

    return theme;
};
