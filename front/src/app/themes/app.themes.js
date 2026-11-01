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
        },
    },
];

export const DEFAULT_THEME = "dark";

export const themeByKey = (key) =>
    APP_THEMES.find((item) => item.key === key) ?? APP_THEMES[0];

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

    return theme;
};
