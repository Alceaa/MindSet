// Всплывающие панели и диалоги: они рисуются в порталах (у body) и тоже не должны
// вылезать за экран — такие поломки не видны при обычной проверке страниц.
const { test, expect } = require("@playwright/test");
const { signIn, createSet, overflowingElements, openPage } = require("./helpers");

const VIEWPORTS = [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
    test.describe(`ширина ${viewport.width}px`, () => {
        test.use({ viewport, isMobile: true, hasTouch: true });

        test("панели и диалоги не вылезают за экран", async ({ page, context }) => {
            await signIn(context);

            const id = await createSet(
                context,
                "# Заголовок\n\nАбзац с **жирным** и <u>подчёркнутым</u>.\n\n```js\nconst answer = 42;\n```\n"
            );

            const problems = [];
            const check = async (name, open) => {
                await open();
                await page.waitForTimeout(700);

                const overflowing = await overflowingElements(page);
                if (overflowing.length > 0) {
                    problems.push(`${name}: ${overflowing.join(", ")}`);
                }

                await page.keyboard.press("Escape");
                await page.waitForTimeout(400);
            };

            await openPage(page, "/dashboard");
            await check("колокольчик уведомлений", () =>
                page.locator(".notificationsTrigger").click()
            );
            await check("меню пользователя", () =>
                page.locator('[aria-label="Меню пользователя"]').click()
            );
            await check("поиск", () => page.locator(".searchTrigger").click());

            await openPage(page, `/sets/${id}`);
            await check("настройки читалки", () =>
                page.locator(".readerSettings button").first().click()
            );

            expect(problems, `\n${problems.join("\n")}`).toEqual([]);
        });
    });
}
