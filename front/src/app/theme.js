import { createTheme } from "@mui/material/styles";
import { APP_THEMES, DEFAULT_THEME, themeByKey, themeMode } from "./themes/app.themes";

/**
 * MUI-тема строится из темы приложения: цвета берём из её набора переменных,
 * а в переопределениях компонентов используем сами CSS-переменные, чтобы
 * смена темы подхватывалась без пересборки стилей.
 */
const tokensFor = (themeKey) => {
    const variables = themeByKey(themeKey).variables;
    const fallback = themeByKey(DEFAULT_THEME).variables;
    const pick = (name) => variables[name] ?? fallback[name];

    return {
        canvas: pick("--bg-canvas"),
        surface: pick("--bg-surface"),
        surfaceMuted: pick("--bg-surface-muted"),
        border: pick("--border"),
        borderMuted: pick("--border-muted"),
        text: pick("--text"),
        textMuted: pick("--text-muted"),
        accent: pick("--accent"),
        accentHover: pick("--accent-hover"),
        accentSoft: pick("--accent-soft"),
        onAccent: pick("--on-accent"),
        success: pick("--success"),
        danger: pick("--danger"),
        warning: pick("--warning"),
    };
};

// Токены тёмной темы оставлены как есть: на них опираются прежние импорты.
export const tokens = tokensFor(DEFAULT_THEME);

export const createAppTheme = (themeKey = DEFAULT_THEME) => {
    const known = APP_THEMES.some((item) => item.key === themeKey);
    const key = known ? themeKey : DEFAULT_THEME;
    const tokens = tokensFor(key);

    return createTheme({
        palette: {
            mode: themeMode(key),
            primary: {
                main: tokens.accent,
                dark: tokens.accentHover,
                contrastText: tokens.onAccent,
            },
            success: { main: tokens.success },
            error: { main: tokens.danger },
            warning: { main: tokens.warning },
            background: {
                default: tokens.canvas,
                paper: tokens.surface,
            },
            text: {
                primary: tokens.text,
                secondary: tokens.textMuted,
            },
            divider: tokens.border,
        },
        shape: {
            borderRadius: 10,
        },
        typography: {
            fontFamily: [
                "Manrope",
                "-apple-system",
                "BlinkMacSystemFont",
                "Segoe UI",
                "Noto Sans",
                "Helvetica",
                "Arial",
                "sans-serif",
            ].join(", "),
            h1: { fontSize: "2rem", fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' },
            h2: { fontSize: "1.5rem", fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' },
            h3: { fontSize: "1.25rem", fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' },
            h4: { fontSize: "1.125rem", fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' },
            h5: { fontSize: "1rem", fontWeight: 600 },
            h6: { fontSize: "0.95rem", fontWeight: 600 },
            button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        // Через переменные: фон и текст следуют выбранной теме.
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text)",
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                        border: "1px solid var(--border)",
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    root: { minHeight: 44, borderBottom: "1px solid var(--border)" },
                    indicator: { height: 2, backgroundColor: "var(--accent)" },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: "none",
                        fontWeight: 500,
                        minHeight: 44,
                        fontSize: "0.95rem",
                        color: "var(--text-muted)",
                        "&.Mui-selected": { color: "var(--text)" },
                    },
                },
            },
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: { borderRadius: 8, paddingInline: 16 },
                },
            },
            MuiAvatar: {
                styleOverrides: {
                    root: {
                        backgroundColor: "var(--bg-surface-muted)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: { border: "1px solid var(--border)" },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: { fontSize: "0.95rem" },
                },
            },
        },
    });
};

const theme = createAppTheme(DEFAULT_THEME);

export default theme;
