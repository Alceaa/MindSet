// Мобильные разрешения: ничего не должно вылезать за край экрана.
//
// Проверка появилась после бага «на телефонах стили вылезают за экран»: правая часть
// шапки не влезала в 320–360px и обрезалась, а прокрутки не было — до кнопок нельзя было добраться.
const { test, expect } = require("@playwright/test");
const {
    signIn,
    createSet,
    createPublicSet,
    overflowingElements,
    openPage,
    LOGIN,
} = require("./helpers");

const VIEWPORTS = [
    { width: 320, height: 800 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
];

let setId;
let publicSlug;

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    await signIn(context);

    const stamp = Date.now();
    setId = await createSet(
        context,
        "# Заголовок\n\nТекст с **жирным** и <u>подчёркнутым</u>.\n\n- один\n- два\n",
        `Мобильная проверка ${stamp}`
    );
    publicSlug = await createPublicSet(
        context,
        "Открытая заметка с **разметкой** и <u>подчёркиванием</u>.\n",
        `Открытая проверка ${stamp}`
    );

    await context.close();
});

const privatePages = () => [
    { path: "/dashboard", name: "главная" },
    { path: "/dashboard?tab=sets", name: "вкладка сетов" },
    { path: "/dashboard?tab=graph", name: "граф" },
    { path: "/explore", name: "обзор" },
    { path: "/news", name: "новости" },
    { path: "/sets/new", name: "новый сет" },
    { path: `/sets/${setId}`, name: "статья" },
    { path: `/sets/${setId}?mode=edit`, name: "редактор", selector: ".mdxEditorHost" },
    { path: "/settings", name: "настройки профиля" },
    { path: "/settings?tab=security", name: "настройки безопасности" },
    { path: "/settings?tab=notifications", name: "настройки уведомлений" },
    { path: `/u/${LOGIN}`, name: "профиль" },
    { path: `/s/${publicSlug}`, name: "открытый сет" },
];

const publicPages = [
    { path: "/", name: "лендинг" },
    { path: "/signin", name: "вход" },
    { path: "/signup", name: "регистрация" },
    { path: "/forgot", name: "забыл пароль" },
    { path: "/reset", name: "сброс пароля" },
    { path: "/verify-email", name: "подтверждение почты" },
    { path: "/nonexistent-page", name: "страница не найдена" },
];

// Открывает страницы подряд и собирает все проблемы: так прогон идёт быстрее,
// чем по тесту на страницу, и в отчёте сразу видно полный список.
async function collectOverflow(page, pages) {
    const problems = [];

    for (const item of pages) {
        await openPage(page, item.path, item.selector);

        const overflowing = await overflowingElements(page);
        if (overflowing.length > 0) {
            problems.push(`${item.name} (${item.path}): ${overflowing.join(", ")}`);
        }

        const scrollX = await page.evaluate(() => {
            window.scrollTo(500, 0);
            const value = window.scrollX;
            window.scrollTo(0, 0);
            return value;
        });
        if (scrollX > 0) {
            problems.push(`${item.name} (${item.path}): страница прокручивается вбок на ${scrollX}px`);
        }
    }

    return problems;
}

for (const viewport of VIEWPORTS) {
    test.describe(`ширина ${viewport.width}px`, () => {
        test.use({ viewport, isMobile: true, hasTouch: true });

        test("страницы под логином не вылезают за экран", async ({ page, context }) => {
            await signIn(context);

            const problems = await collectOverflow(page, privatePages());
            expect(problems, `\n${problems.join("\n")}`).toEqual([]);
        });

        test("страницы без входа не вылезают за экран", async ({ page }) => {
            const problems = await collectOverflow(page, publicPages);
            expect(problems, `\n${problems.join("\n")}`).toEqual([]);
        });

        test("шапка: кнопки действий доступны на экране", async ({ page, context }) => {
            await signIn(context);
            await openPage(page, "/dashboard");

            const box = await page.locator(".headerActions").boundingBox();
            expect(box, "шапка не найдена").toBeTruthy();
            expect(
                Math.round(box.x + box.width),
                "правая часть шапки ушла за экран"
            ).toBeLessThanOrEqual(viewport.width);

            // Кнопка создания сета остаётся кликабельной (на узких экранах — только «+»).
            await expect(page.locator(".createSet")).toBeVisible();
        });
    });
}

