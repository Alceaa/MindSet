const { test, expect } = require("@playwright/test");
const { signIn, openPage, overflowingElements } = require("./helpers");

test("тема создаётся, уходит на модерацию и удаляется", async ({ page, context }) => {
    await signIn(context);
    await openPage(page, "/settings?tab=appearance", ".settingsPanel");

    const title = `E2E тема ${Date.now()}`;
    const key = `e2e-${Date.now()}`;

    await page.click('button:has-text("Создать тему")');
    await page.fill('input[placeholder="Северные сумерки"]', title);
    await page.fill('input[placeholder="northern-dusk"]', key);

    const variableRow = page.locator(".themeVariableRow", { hasText: "Фон страницы" });
    await variableRow.locator('input[type="checkbox"]').check();
    await variableRow.locator("input.themeVariableValue").fill("#101828");

    await expect(page.locator(".themePreviewSwatch").first()).toBeVisible();
    await page.click('button:has-text("Создать черновик")');

    const row = page.locator(".tokenRow", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText("черновик");
    await expect(row).toContainText(key);

    await page.click('button:has-text("Отмена")');

    await row.locator('button:has-text("На модерацию")').click();
    await expect(page.locator(".tokenRow", { hasText: title })).toContainText("на модерации");

    await page.click('button:has-text("Создать тему")');
    await page.fill('input[placeholder="Северные сумерки"]', `${title} — повтор`);
    await page.fill('input[placeholder="northern-dusk"]', key);
    await expect(page.locator(".themeVariableRow", { hasText: "Фон страницы" })).toBeVisible();
    await page.click('button:has-text("Взять из базы")');
    await page.click('button:has-text("Создать черновик")');
    await expect(page.locator(".alert")).toContainText("уже есть");
    await page.click('button:has-text("Отмена")');

    const list = page.locator(".tokenRow", { hasText: title });
    await list.locator('button:has-text("Удалить")').click();
    await list.locator('button:has-text("Удалить")').click();
    await expect(page.locator(".tokenRow", { hasText: title })).toHaveCount(0);

    expect(await overflowingElements(page)).toEqual([]);
});
