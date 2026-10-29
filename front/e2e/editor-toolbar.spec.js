// Панель редактора: выпадающие списки MDXEditor не должны срывать её с места.
//
// Проверка появилась после бага «после выбора типа блока панель улетает вверх»:
// MDXEditor вешал на body блокировку прокрутки (overflow: hidden !important),
// из-за чего position: sticky у панели переставал работать.
const { test, expect } = require("@playwright/test");
const { signIn, createSet, openPage } = require("./helpers");

test("список типов блоков не срывает липкую панель редактора", async ({ page, context }) => {
    await signIn(context);
    const id = await createSet(context, "Первый абзац\n\nВторой абзац\n");

    await page.goto(`/sets/${id}?mode=edit`, { waitUntil: "domcontentloaded" });

    const toolbar = page.locator('.mdxEditorHost [class*="_toolbarRoot_"]');
    await toolbar.waitFor({ timeout: 60 * 1000 });
    await page.waitForTimeout(2000);

    const before = await toolbar.boundingBox();
    expect(before, "панель редактора не найдена").toBeTruthy();

    await page.locator('.mdxEditorHost [class*="_selectTrigger_"]').first().click();
    await page.waitForTimeout(800);

    const after = await toolbar.boundingBox();
    expect(
        Math.abs(after.y - before.y),
        `панель сдвинулась: было ${before.y}, стало ${after.y}`
    ).toBeLessThan(2);

    // Сам список открылся и целиком помещается на экране.
    const popup = page.locator('.mdxeditor-popup-container [class*="_selectContainer_"]').first();
    await expect(popup).toBeVisible();

    const popupBox = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(popupBox.y, "список открылся выше экрана").toBeGreaterThanOrEqual(-1);
    expect(
        popupBox.y + popupBox.height,
        "список ушёл за нижний край экрана"
    ).toBeLessThanOrEqual(viewport.height + 1);

    // Длинные списки прокручиваются внутри себя.
    const overflowY = await popup.evaluate((el) => getComputedStyle(el).overflowY);
    expect(["auto", "scroll"], `список не прокручивается (overflow-y: ${overflowY})`).toContain(
        overflowY
    );
});
