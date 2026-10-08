import { createTheme } from "@mui/material/styles";
export const tokens = {
    canvas: "#0d0f14",
    surface: "#151821",
    surfaceMuted: "#1d202b",
    border: "#262a35",
    borderMuted: "#1c2029",
    text: "#ece7dc",
    textMuted: "#9a948a",
    accent: "#e2b053",
    accentHover: "#c99a37",
    accentSoft: "rgba(226, 176, 83, 0.14)",
    success: "#57c469",
    danger: "#f0655f",
    warning: "#e0913f",
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
                root: { borderRadius: 8, paddingInline: 16 },
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
