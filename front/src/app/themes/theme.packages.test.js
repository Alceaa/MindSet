import {
    CUSTOM_THEME_PREFIX,
    THEME_VARIABLE_GROUPS,
    THEME_VARIABLE_NAMES,
    isHexColor,
    themeVariableLabel,
    validThemeColor,
    validThemeKey,
} from "./theme.packages";
import {
    APP_THEMES,
    customThemeFromPackage,
    isCustomTheme,
    registerThemePackages,
    themeByKey,
} from "./app.themes";

beforeEach(() => {
    window.localStorage.clear();
});

test("белый список переменных без повторов и с подписями", () => {
    const seen = new Set();

    THEME_VARIABLE_GROUPS.forEach((group) => {
        expect(group.title).toBeTruthy();
        group.variables.forEach((item) => {
            expect(item.name.startsWith("--")).toBe(true);
            expect(seen.has(item.name)).toBe(false);
            seen.add(item.name);
            expect(themeVariableLabel(item.name)).toBe(item.label);
        });
    });

    expect(THEME_VARIABLE_NAMES.length).toBe(seen.size);
    expect(THEME_VARIABLE_NAMES.length).toBeGreaterThan(30);
});

test("ключ и цвет проверяются строго", () => {
    expect(validThemeKey("northern-dusk")).toBe(true);
    expect(validThemeKey("Плохой ключ")).toBe(false);
    expect(validThemeKey("ab")).toBe(false);
    expect(validThemeKey("with_underscore")).toBe(false);

    expect(validThemeColor("#0d0f14")).toBe(true);
    expect(validThemeColor("rgba(226, 176, 83, 0.14)")).toBe(true);
    expect(validThemeColor("url(https://example.com/x.png)")).toBe(false);
    expect(validThemeColor("blue")).toBe(false);
    expect(validThemeColor("#fff;} body{display:none")).toBe(false);

    expect(isHexColor("#0d0f14")).toBe(true);
    expect(isHexColor("rgba(1, 2, 3, 0.5)")).toBe(false);
});

test("пакет темы собирается поверх базовой темы", () => {
    const theme = customThemeFromPackage({
        key: "northern-dusk",
        title: "Северные сумерки",
        description: "Холодный вечер",
        mode: "dark",
        base: "dark",
        author: "verifyuser",
        variables: {
            "--bg-canvas": "#0f1420",
            "--accent": "url(x)",
            "--unknown": "#ffffff",
        },
    });

    expect(theme.key).toBe(`${CUSTOM_THEME_PREFIX}northern-dusk`);
    expect(theme.label).toBe("Северные сумерки");
    expect(theme.mode).toBe("dark");
    expect(theme.variables["--bg-canvas"]).toBe("#0f1420");
    expect(theme.variables["--accent"]).toBe(
        APP_THEMES[0].variables["--accent"]
    );
    expect(theme.variables["--unknown"]).toBeUndefined();
    expect(Object.keys(theme.variables).length).toBe(Object.keys(APP_THEMES[0].variables).length);

    expect(customThemeFromPackage({ key: "empty", variables: { "--accent": "nope" } })).toBeNull();
    expect(isCustomTheme(theme.key)).toBe(true);
    expect(isCustomTheme("dark")).toBe(false);
});

test("зарегистрированные темы доступны по ключу и переживают перезагрузку", () => {
    registerThemePackages([
        {
            key: "northern-dusk",
            title: "Северные сумерки",
            mode: "dark",
            base: "dark",
            variables: { "--accent": "#7cc7ff" },
        },
    ]);

    const registered = themeByKey(`${CUSTOM_THEME_PREFIX}northern-dusk`);
    expect(registered.variables["--accent"]).toBe("#7cc7ff");
    expect(registered.variables["--bg-canvas"]).toBe(APP_THEMES[0].variables["--bg-canvas"]);

    const cached = JSON.parse(window.localStorage.getItem("mindset:theme:cache"));
    expect(cached[`${CUSTOM_THEME_PREFIX}northern-dusk`].variables["--accent"]).toBe("#7cc7ff");
});

test("неизвестный ключ отдаёт тему по умолчанию", () => {
    expect(themeByKey("нет-такой").key).toBe(APP_THEMES[0].key);
    expect(themeByKey(`${CUSTOM_THEME_PREFIX}unknown`).key).toBe(APP_THEMES[0].key);
});
