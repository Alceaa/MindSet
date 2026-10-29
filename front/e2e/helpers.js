// Общие помощники для браузерных проверок.
const { expect } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const LOGIN = process.env.E2E_LOGIN || "verifyuser";
const PASSWORD = process.env.E2E_PASSWORD || "verify-password-123";

// Вход через API: cookie сессии попадают в тот же контекст, что и страницы.
async function signIn(context) {
    const response = await context.request.post(`${BASE_URL}/auth/login`, {
        data: { login: LOGIN, password: PASSWORD },
    });

    expect(
        response.ok(),
        `вход ${LOGIN} не удался (${response.status()}): ${await response.text()}`
    ).toBeTruthy();
}

// Создаёт приватный сет и возвращает его id.
async function createSet(context, content, title = `Проверка ${Date.now()}`) {
    const response = await context.request.post(`${BASE_URL}/sets`, {
        data: { title, description: "", visibility: "private", content },
    });

    expect(response.ok(), `сет не создан (${response.status()})`).toBeTruthy();

    const body = await response.json();
    const id = body?.set?.id ?? body?.id;
    expect(id, "ответ создания сета без id").toBeTruthy();

    return id;
}

// Создаёт открытый сет и возвращает его slug — для проверки публичной страницы.
async function createPublicSet(context, content, title = `Открытая проверка ${Date.now()}`) {
    const response = await context.request.post(`${BASE_URL}/sets`, {
        data: { title, description: "", visibility: "public", content },
    });

    expect(response.ok(), `открытый сет не создан (${response.status()})`).toBeTruthy();

    const body = await response.json();
    const slug = body?.set?.slug;
    expect(slug, "у созданного сета нет slug").toBeTruthy();

    return slug;
}

// Содержимое сета на сервере — чтобы проверить, что редактор сохранил именно то, что нужно.
async function fetchSetContent(context, id) {
    const response = await context.request.get(`${BASE_URL}/sets/${id}`);
    expect(response.ok(), `сет ${id} не прочитан (${response.status()})`).toBeTruthy();

    const body = await response.json();
    return body?.set?.content ?? body?.content ?? "";
}

// Элементы, вылезающие за правый край окна. Потомков горизонтально прокручиваемых
// контейнеров не считаем: такие блоки (таблицы, код) прокручиваются внутри себя
// и не ломают страницу.
async function overflowingElements(page) {
    return page.evaluate(() => {
        const width = window.innerWidth;
        const all = [...document.querySelectorAll("body *")];
        const scrollers = all.filter((el) => {
            const overflowX = getComputedStyle(el).overflowX;
            return overflowX === "auto" || overflowX === "scroll";
        });
        const insideScroller = (el) =>
            scrollers.some((box) => box !== el && box.contains(el));

        return all
            .filter((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.right <= width + 1) {
                    return false;
                }
                return !insideScroller(el);
            })
            .map((el) => {
                const rect = el.getBoundingClientRect();
                const cls = String(el.className).split(" ")[0];
                return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} (правый край ${Math.round(rect.right)} при ширине ${width})`;
            });
    });
}

// Открывает страницу и ждёт, пока подгрузятся данные.
async function openPage(page, path, selector = "#root") {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(selector, { timeout: 30 * 1000 });
    await page.waitForTimeout(1200);
}

// Дописывает текст в конец первого фрагмента, содержащего подстроку: так проверяем
// обычную правку заметки, не задевая команды форматирования.
async function appendToText(page, needle, text) {
    await page.waitForSelector('.mdxEditorHost [contenteditable="true"]', {
        timeout: 60 * 1000,
    });
    await page.waitForTimeout(1500);

    const found = await page.evaluate((needle) => {
        const editable = document.querySelector('.mdxEditorHost [contenteditable="true"]');
        const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
        let node;

        while ((node = walker.nextNode())) {
            if (node.textContent.includes(needle)) {
                const range = document.createRange();
                range.setStart(node, node.textContent.length);
                range.collapse(true);

                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                document.dispatchEvent(new Event("selectionchange"));
                return true;
            }
        }

        return false;
    }, needle);

    expect(found, `в редакторе не найден текст «${needle}»`).toBeTruthy();

    await page.keyboard.type(text);
    await page.waitForTimeout(300);
}

// Сохраняет заметку кнопкой в панели редактора.
async function saveSet(page) {
    await page.click(".setToolbar .btnPrimary");
    await page.waitForTimeout(2500);
}

module.exports = {
    BASE_URL,
    LOGIN,
    PASSWORD,
    signIn,
    createSet,
    createPublicSet,
    fetchSetContent,
    overflowingElements,
    openPage,
    appendToText,
    saveSet,
};
