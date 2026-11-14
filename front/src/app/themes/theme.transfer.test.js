import { THEME_PRESETS } from "./theme.roles";
import {
    parseThemeFile,
    themeFileText,
    themeFileName,
    themeToFile,
    THEME_FILE_KIND,
} from "./theme.transfer";

const preset = THEME_PRESETS[0];

test("файл темы содержит роли и читается обратно", () => {
    const file = themeToFile({ title: "Морская ночь", description: "Синяя", mode: "light", base: "nord", roles: preset.roles });

    expect(file.kind).toBe(THEME_FILE_KIND);
    expect(file.version).toBe(1);
    expect(file.base).toBe("nord");
    expect(file.mode).toBe("light");
    expect(Object.keys(file.roles)).toHaveLength(8);

    // Круговой обмен: экспорт → импорт даёт те же цвета.
    const parsed = parseThemeFile(themeFileText({ title: "Морская ночь", mode: "light", base: "nord", roles: preset.roles }));

    expect(parsed.ok).toBe(true);
    expect(parsed.theme.roles).toEqual(file.roles);
    expect(parsed.theme.base).toBe("nord");
    expect(parsed.theme.mode).toBe("light");
});

test("импорт принимает и просто объект с ролями", () => {
    const parsed = parseThemeFile(JSON.stringify({ roles: { accent: "#5FC4D8" } }));

    expect(parsed.ok).toBe(true);
    expect(parsed.theme.roles.accent).toBe("#5fc4d8");
    // Остальные роли добираются значениями по умолчанию, чтобы тема была целой.
    expect(parsed.theme.roles.canvas).toMatch(/^#[0-9a-f]{6}$/);
    expect(parsed.suggestedTitle).toBe("Импортированная тема");
});

test("импорт объясняет ошибку вместо молчания", () => {
    expect(parseThemeFile("").ok).toBe(false);
    expect(parseThemeFile("не json").error).toMatch(/JSON/);
    expect(parseThemeFile(JSON.stringify({ kind: "other.thing", roles: { accent: "#ffffff" } })).error).toMatch(
        /файл темы/
    );
    expect(parseThemeFile(JSON.stringify({ version: 99, roles: { accent: "#ffffff" } })).error).toMatch(
        /новой версией/
    );
    expect(parseThemeFile(JSON.stringify({ roles: { shadow: "#ffffff" } })).error).toMatch(/не поддерживается/);
    expect(parseThemeFile(JSON.stringify({ roles: { accent: "#fff" } })).error).toMatch(/#rrggbb/);
    expect(parseThemeFile(JSON.stringify({ roles: {} })).error).toMatch(/нет ни одного цвета/);
});

test("имя файла собирается из названия и всегда годное", () => {
    expect(themeFileName("Sea Night")).toBe("sea-night.theme.json");
    // В названии нет латиницы — берём ключ темы, он уже транслитерирован.
    expect(themeFileName("Морская ночь", "morskaya-noch")).toBe("morskaya-noch.theme.json");
    expect(themeFileName("", "")).toBe("mindset-theme.theme.json");
});
