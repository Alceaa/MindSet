const { test, expect } = require("@playwright/test");
const { BASE_URL, LOGIN, signIn, openPage, overflowingElements } = require("./helpers");

test("токен интеграции создаётся, работает и отзывается", async ({ page, context }) => {
    await signIn(context);
    await openPage(page, "/settings?tab=integrations", ".settingsPanel");

    await expect(page.locator(".settingsPanelTitle")).toHaveText("Интеграции");

    const title = `Проверка E2E ${Date.now()}`;
    await page.fill(".settingsPanel input.input", title);
    await page.click('button:has-text("Создать токен")');

    const value = page.locator(".tokenValue");
    await expect(value).toBeVisible();

    const secret = (await value.textContent()).trim();
    expect(secret.startsWith("msk_"), `неожиданное значение токена: ${secret}`).toBeTruthy();

    const row = page.locator(".tokenRow", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.locator(".tokenMeta")).toContainText(secret.slice(0, 10));
    await expect(page.locator(".tokenRow")).not.toContainText(secret);

    await page.click('button:has-text("Готово")');
    await expect(page.locator(".tokenValue")).toHaveCount(0);

    const me = await context.request.get(`${BASE_URL}/api/v1/me`, {
        headers: { Authorization: `Bearer ${secret}` },
    });
    expect(me.status(), "запрос по токену не прошёл").toBe(200);
    expect((await me.json()).user?.login).toBe(LOGIN);

    const sets = await context.request.get(`${BASE_URL}/api/v1/sets?limit=3`, {
        headers: { Authorization: `Bearer ${secret}` },
    });
    expect(sets.status()).toBe(200);

    const withSession = await context.request.get(`${BASE_URL}/api/v1/me`);
    expect(withSession.status(), "cookie-сессия не должна открывать /api/v1").toBe(401);

    await row.locator('button:has-text("Отозвать")').click();
    await row.locator(".tokenRowActions .btnDanger").click();
    await expect(page.locator(".tokenRow", { hasText: title })).toHaveCount(0);

    const afterRevoke = await context.request.get(`${BASE_URL}/api/v1/me`, {
        headers: { Authorization: `Bearer ${secret}` },
    });
    expect(afterRevoke.status(), "отозванный токен продолжает работать").toBe(401);

    expect(await overflowingElements(page)).toEqual([]);
});
