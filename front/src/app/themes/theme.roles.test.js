import { APP_THEMES, themeByKey } from "./app.themes";
import {
    ROLE_VARIABLES,
    THEME_PRESETS,
    THEME_ROLES,
    buildThemeVariables,
    contrastRatio,
    contrastText,
    contrastWarnings,
    isRoleColor,
    mix,
    rolesFromVariables,
} from "./theme.roles";

test("смешивание и контраст считаются как в WCAG", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#101010", "#101010", 0.7)).toBe("#101010");
    expect(Math.round(contrastRatio("#000000", "#ffffff"))).toBe(21);
    expect(contrastText("#ffffff")).toBe("#111311");
    expect(contrastText("#101010")).toBe("#f7f9f7");
});

test("тема из восьми цветов даёт все переменные встроенной темы", () => {
    const builtIn = new Set(Object.keys(APP_THEMES[0].variables));
    expect(builtIn.size).toBe(55);

    THEME_PRESETS.forEach((preset) => {
        const variables = buildThemeVariables(preset.roles, preset.base);
        const names = Object.keys(variables);

        expect(names.length).toBe(builtIn.size);
        builtIn.forEach((name) => {
            expect(variables[name]).toBeTruthy();
        });
    });
});

test("роли попадают в свои переменные", () => {
    const roles = THEME_PRESETS[1].roles;
    const variables = buildThemeVariables(roles, THEME_PRESETS[1].base);

    THEME_ROLES.forEach((role) => {
        expect(variables[ROLE_VARIABLES[role.key]]).toBe(roles[role.key]);
    });

    // Производные значения — цвета, а не мусор.
    expect(variables["--text-muted"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(variables["--accent-soft"]).toMatch(/^rgba\(/);
    expect(isRoleColor(variables["--accent-hover"])).toBe(true);
});

test("роли разворачиваются в переменные и возвращаются обратно", () => {
    const preset = THEME_PRESETS[2];
    const variables = buildThemeVariables(preset.roles, preset.base);

    // Переменные считаем из восьми ролей, а тени и подсветку кода берём из базовой темы.
    expect(variables["--bg-canvas"]).toBe(preset.roles.canvas);
    expect(variables["--shadow"]).toBe(themeByKey(preset.base).variables["--shadow"]);

    expect(rolesFromVariables(variables)).toEqual(preset.roles);
});

test("пресеты не повторяют базовые темы и не дублируются", () => {
    const keys = THEME_PRESETS.map((preset) => preset.key);
    const titles = THEME_PRESETS.map((preset) => preset.title);

    // Сепия уже есть среди базовых тем, поэтому в пресетах её быть не должно.
    expect(keys).not.toContain("sepia");
    expect(keys.length).toBe(new Set(keys).size);
    expect(titles.length).toBe(new Set(titles).size);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    // Пресеты не сбиваются в одну базовую тему: часть строится поверх nord и sepia.
    expect(new Set(THEME_PRESETS.map((preset) => preset.base)).size).toBeGreaterThanOrEqual(3);

    THEME_PRESETS.forEach((preset) => {
        expect(THEME_ROLES.every((role) => isRoleColor(preset.roles[role.key]))).toBe(true);
        expect(APP_THEMES.some((theme) => theme.key === preset.base)).toBe(true);
    });
});

test("базовая тема задаёт производные значения, цвета берём из ролей", () => {
    const preset = THEME_PRESETS.find((item) => item.key === "sea");
    const nord = themeByKey("nord").variables;
    const onNord = buildThemeVariables(preset.roles, "nord");
    const onDark = buildThemeVariables(preset.roles, "dark");

    // Тени, подсветка кода и цвета графа приходят из базовой темы.
    expect(onNord["--shadow"]).toBe(nord["--shadow"]);
    expect(onNord["--graph-edge"]).toBe(nord["--graph-edge"]);
    expect(onNord["--code-string"]).toBe(nord["--code-string"]);
    expect(onNord["--code-keyword"]).not.toBe(onDark["--code-keyword"]);

    // А ядро остаётся тем же: его считаем из восьми ролей.
    expect(onNord["--bg-canvas"]).toBe(onDark["--bg-canvas"]);
    expect(onNord["--accent"]).toBe(onDark["--accent"]);
});

test("пресеты не дают предупреждений о контрасте", () => {
    THEME_PRESETS.forEach((preset) => {
        const warnings = contrastWarnings(preset.roles)
            .map((item) => `${preset.key}: ${item.text}`)
            .join(", ");
        expect(warnings).toBe("");
    });
});

test("контраст ловит нечитаемую пару", () => {
    const warnings = contrastWarnings({
        canvas: "#000000",
        surface: "#000000",
        text: "#000000",
        border: "#000000",
        accent: "#000000",
        danger: "#000000",
        warning: "#000000",
        success: "#000000",
    });

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((item) => /Текст на фоне/.test(item.label))).toBe(true);
});
