// Данные и мобильность: серверный поиск, догрузка списка, выгрузка архива и печать статьи.
const { test, expect } = require("@playwright/test");
const { signIn, createSet, BASE_URL } = require("./helpers");

test("поиск по своим сетам находит слово из текста заметки", async ({ page, context }) => {
    await signIn(context);

    const marker = `уникум${Date.now()}`;
    await createSet(context, `# Проверка поиска\n\nВнутри заметки есть слово ${marker}.\n`, `Поиск ${marker}`);
    await createSet(context, "# Другой сет\n\nСовсем про другое.\n", `Другой ${marker}`);

    await page.goto("/dashboard?tab=sets", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".setFilterSearch", { timeout: 30 * 1000 });
    await page.waitForTimeout(1500);

    // Печатаем посимвольно: так проверяем, что поле не теряет фокус, пока идёт запрос.
    await page.locator(".setFilterSearch").click();
    await page.locator(".setFilterSearch").pressSequentially(marker, { delay: 60 });
    await page.waitForTimeout(2500);

    await expect(page.locator(".setFilterSearch")).toHaveValue(marker);

    // Находится обе заметки: слово есть и в названии, и в тексте.
    const titles = await page.locator(".setListTitle").allInnerTexts();
    expect(titles.length, "поиск ничего не нашёл").toBeGreaterThan(0);
    expect(titles.some((title) => title.includes(marker))).toBeTruthy();

    const counter = await page.locator(".feedSectionTitle").first().innerText();
    expect(counter.replace(/\s+/g, " ")).toContain(String(titles.length));
});

test("список своих сетов приходит страницами и догружается", async ({ page, context }) => {
    await signIn(context);

    const stamp = Date.now();
    const total = 25;

    for (let index = 0; index < total; index += 1) {
        await createSet(context, `# Страница ${index}\n`, `Догрузка ${stamp}-${index}`);
    }

    await page.goto("/dashboard?tab=sets", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".setFilterSearch", { timeout: 30 * 1000 });
    await page.waitForTimeout(2000);

    await page.fill(".setFilterSearch", `Догрузка ${stamp}`);
    await page.waitForTimeout(2500);

    const firstPage = await page.locator(".setList > li").count();
    expect(firstPage, "первая страница пустая").toBeGreaterThan(0);
    expect(firstPage, "первая страница больше размера страницы").toBeLessThanOrEqual(24);

    const more = page.locator(".loadMoreRow button");
    await expect(more, "нет кнопки догрузки при 25 сетах").toBeVisible();

    await more.click();
    await page.waitForTimeout(2500);

    const afterLoad = await page.locator(".setList > li").count();
    expect(afterLoad, "догрузка не добавила сетов").toBeGreaterThan(firstPage);
    await expect(more).toHaveCount(0);
});

test("выгрузка данных отдаёт zip-архив", async ({ context }) => {
    await signIn(context);

    const response = await context.request.get(`${BASE_URL}/users/me/export`);
    expect(response.status(), "выгрузка не отдалась").toBe(200);
    expect(response.headers()["content-type"]).toContain("application/zip");

    const body = await response.body();
    expect(body.length, "архив пустой").toBeGreaterThan(1000);
    // ZIP начинается сигнатурой PK.
    expect(body.subarray(0, 2).toString("latin1")).toBe("PK");
});

test("печать показывает статью без интерфейса и светлым", async ({ page, context }) => {
    await signIn(context);

    const id = await createSet(
        context,
        "# Заголовок для печати\n\nАбзац статьи.\n",
        `Печать E2E ${Date.now()}`
    );
    await page.goto(`/sets/${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".article", { timeout: 30 * 1000 });
    await page.waitForTimeout(1500);

    await expect(page.locator("button", { hasText: "Печать" }).first()).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(500);

    const printView = await page.evaluate(() => {
        const style = (selector) => {
            const element = document.querySelector(selector);
            return element ? getComputedStyle(element) : null;
        };

        return {
            шапка: style(".appHeader")?.display,
            тулбар: style(".setToolbar")?.display,
            статья: style(".article")?.display,
            фонСтатьи: style(".articleCard")?.backgroundColor,
            цветТекста: style(".article")?.color,
        };
    });

    expect(printView.шапка, "шапка печатается").toBe("none");
    expect(printView.тулбар, "панель кнопок печатается").toBe("none");
    expect(printView.статья, "статья не печатается").toBe("block");
    expect(printView.фонСтатьи, "фон статьи тёмный").toBe("rgb(255, 255, 255)");
    expect(printView.цветТекста, "текст статьи светлый").toBe("rgb(17, 17, 17)");

    await page.emulateMedia({ media: "screen" });
});

test("панель «Данные» скачивает архив", async ({ page, context }) => {
    await signIn(context);

    await page.goto("/settings?tab=data", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".settingsPanelTitle", { timeout: 30 * 1000 });
    await expect(page.locator(".settingsPanelTitle")).toHaveText("Данные");

    const downloadPromise = page.waitForEvent("download", { timeout: 30 * 1000 });
    await page.locator("button", { hasText: "Скачать все данные" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^mindset-export-\d{4}-\d{2}-\d{2}\.zip$/);
    await expect(page.locator(".alert").first()).toContainText("Архив скачан");
});
