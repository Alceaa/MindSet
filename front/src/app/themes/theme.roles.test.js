import { APP_THEMES } from "./app.themes";
import {
    ROLE_VARIABLES,
    THEME_PRESETS,
    THEME_ROLES,
    buildThemeVariables,
    contrastRatio,
    contrastText,
    contrastWarnings,
    isRoleColor,
    localThemePackage,
    mix,
    packageVariables,
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
    const variables = buildThemeVariables(roles, "dark");

    THEME_ROLES.forEach((role) => {
        expect(variables[ROLE_VARIABLES[role.key]]).toBe(roles[role.key]);
    });

    // Производные значения — цвета, а не мусор.
    expect(variables["--text-muted"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(variables["--accent-soft"]).toMatch(/^rgba\(/);
    expect(isRoleColor(variables["--accent-hover"])).toBe(true);
});

test("пресеты не дают предупреждений о контрасте", () => {
    THEME_PRESETS.forEach((preset) => {
        const warnings = contrastWarnings(preset.roles)
            .map((item) => `${preset.key}: ${item.text}`)
            .join(", ");
        expect(warnings).toBe("");
    });
});

test("чёрная тема предупреждает про нечитаемый текст", () => {
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

test("пакет темы собирается из ролей и возвращается обратно", () => {
    const preset = THEME_PRESETS[2];
    const variables = packageVariables(preset.roles, preset.base);

    // В пакет уезжает только белый список сервера: 52 переменные без теней и градиента.
    expect(Object.keys(variables).length).toBe(52);
    expect(variables["--bg-canvas"]).toBe(preset.roles.canvas);
    expect(variables["--shadow"]).toBeUndefined();

    const roles = rolesFromVariables(variables);
    expect(roles).toEqual(preset.roles);
});

test("тема профиля превращается в запись реестра", () => {
    const preset = THEME_PRESETS[0];
    const pkg = localThemePackage({ title: "  Моя тема  ", mode: preset.mode, base: preset.base, roles: preset.roles });

    expect(pkg.key).toBe("local");
    expect(pkg.title).toBe("Моя тема");
    expect(pkg.mode).toBe("dark");
    expect(Object.keys(pkg.variables).length).toBe(55);
});
