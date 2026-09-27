import { createTheme } from "@mui/material/styles";
export const tokens = {
    canvas: "#0d1117",
    surface: "#161b22",
    surfaceMuted: "#21262d",
    border: "#30363d",
    borderMuted: "#21262d",
    text: "#e6edf3",
    textMuted: "#8b949e",
    accent: "#2f81f7",
    accentHover: "#1f6feb",
    accentSoft: "rgba(56, 139, 253, 0.15)",
    success: "#3fb950",
    danger: "#f85149",
    warning: "#d29922",
};

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: tokens.accent,
            dark: tokens.accentHover,
            contrastText: "#ffffff",
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
        borderRadius: 6,
    },
    typography: {
        fontFamily: [
            "-apple-system",
            "BlinkMacSystemFont",
            "Segoe UI",
            "Noto Sans",
            "Helvetica",
            "Arial",
            "sans-serif",
        ].join(", "),
        h1: { fontSize: "2rem", fontWeight: 600 },
        h2: { fontSize: "1.5rem", fontWeight: 600 },
        h3: { fontSize: "1.25rem", fontWeight: 600 },
        h4: { fontSize: "1.125rem", fontWeight: 600 },
        h5: { fontSize: "1rem", fontWeight: 600 },
        button: { textTransform: "none", fontWeight: 500 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: tokens.canvas,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    border: `1px solid ${tokens.border}`,
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: { minHeight: 44, borderBottom: `1px solid ${tokens.border}` },
                indicator: { height: 2, backgroundColor: tokens.accent },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 500,
                    minHeight: 44,
                    fontSize: "0.95rem",
                    color: tokens.textMuted,
                    "&.Mui-selected": { color: tokens.text },
                },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { borderRadius: 6, paddingInline: 16 },
            },
        },
        MuiAvatar: {
            styleOverrides: {
                root: {
                    backgroundColor: tokens.surfaceMuted,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.text,
                    fontSize: "0.9rem",
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: { border: `1px solid ${tokens.border}` },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: { fontSize: "0.95rem" },
            },
        },
    },
});

export default theme;
