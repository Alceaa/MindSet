const { test, expect } = require("@playwright/test");
const { signIn, openPage, overflowingElements } = require("./helpers");

test("тема собирается, применяется, импортируется и удаляется", async ({ page, context }) => {
    await signIn(context);
    await openPage(page, "/settings?tab=appearance", ".settingsPanel");

    const title = `E2E тема ${Date.now()}`;

    // Собираем тему в конструкторе: название, описание и пресет «Море».
    await page.fill('input[placeholder="Морская ночь"]', title);
    await page.fill('input[placeholder="Пара слов для списка тем"]', "Проверка из браузера");
    await page.click('.themePresets button:has-text("Море")');
    await page.click('button:has-text("Сохранить в библиотеку")');

    const row = page.locator(".tokenRow", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText("база: nord");
    await expect(page.getByText(/Сохранено \d+ из 10/)).toBeVisible();

    // Сохранение сразу включает тему: акцент берём из применённых переменных.
    const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
    );
    expect(accent).toBe("#5fc4d8");

    // Импорт: вставленный текст темы открывается в конструкторе и сам не сохраняется.
    const before = await page.locator(".tokenRow").count();
    await page.fill(
        '[aria-label="Текст темы"]',
        JSON.stringify({
            kind: "mindset.theme",
            version: 1,
            title: `${title} — копия`,
            mode: "dark",
            base: "dark",
            roles: {
                canvas: "#101216",
                surface: "#181c22",
                text: "#e8eaee",
                border: "#2a2f38",
                accent: "#b58cff",
                danger: "#e07a7a",
                warning: "#d8b06a",
                success: "#86c9a2",
            },
        })
    );
    await page.click('button:has-text("Загрузить из текста")');
    await expect(page.locator('input[placeholder="Морская ночь"]')).toHaveValue(`${title} — копия`);
    await expect(page.locator(".tokenRow")).toHaveCount(before);

    // Мусор вместо темы даёт понятную ошибку, а не пустой экран.
    await page.fill('[aria-label="Текст темы"]', "это не тема");
    await page.click('button:has-text("Загрузить из текста")');
    await expect(page.locator(".alert")).toContainText("не разобрали JSON");

    // Удаление своей темы — в два шага, с подтверждением.
    await row.locator('button:has-text("Удалить")').click();
    await row.locator('button:has-text("Удалить")').click();
    await expect(page.locator(".tokenRow", { hasText: title })).toHaveCount(0);

    expect(await overflowingElements(page)).toEqual([]);
});

