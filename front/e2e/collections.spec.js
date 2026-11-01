// Коллекции: раскладка сетов по полкам, фильтр, группы в сайдбаре и приватность.
const { test, expect } = require("@playwright/test");
const { signIn, createSet, BASE_URL } = require("./helpers");

// Перед прогоном убираем прежние коллекции: проверка должна быть воспроизводимой.
async function resetCollections(context) {
    const response = await context.request.get(`${BASE_URL}/collections`);
    const body = await response.json();

    for (const item of body.collections ?? []) {
        await context.request.delete(`${BASE_URL}/collections/${item.id}`);
    }
}

// После прогона тоже чистим: иначе созданные коллекции влияют на другие проверки
// (например, включают группировку на странице «Сеты»).
test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    await signIn(context);
    await resetCollections(context);
    await context.close();
});

async function createCollection(context, title, color = "") {
    const response = await context.request.post(`${BASE_URL}/collections`, {
        data: { title, color },
    });
    expect(response.ok(), `коллекция не создана (${response.status()})`).toBeTruthy();

    const body = await response.json();
    return body.collection;
}

// Сет по умолчанию личный: для проверки приватности делаем его публичным.
async function makePublic(context, setId, title) {
    const response = await context.request.put(`${BASE_URL}/sets/${setId}`, {
        data: { title, description: "", visibility: "public", content: "# Публичный\n" },
    });
    expect(response.ok(), `сет не стал публичным (${response.status()})`).toBeTruthy();
}

test("сет раскладывается по коллекциям и возвращается обратно", async ({ context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    const first = await createCollection(context, `Полка ${stamp}`, "blue");
    const second = await createCollection(context, `Вторая ${stamp}`, "green");
    const setId = await createSet(context, "# Заметка\n\nТекст.\n", `Сет для полки ${stamp}`);

    // Сет может лежать сразу в нескольких коллекциях
    expect(
        (await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
            data: { collection_id: first.id },
        })).status()
    ).toBe(200);
    expect(
        (await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
            data: { collection_id: second.id },
        })).status()
    ).toBe(200);

    // Повторное добавление ничего не ломает
    expect(
        (await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
            data: { collection_id: first.id },
        })).status()
    ).toBe(200);

    let listed = await (await context.request.get(`${BASE_URL}/sets?limit=5`)).json();
    let target = (listed.sets ?? []).find((item) => item.id === setId);
    const titles = (target.collections ?? []).map((item) => item.title);
    expect(titles).toContain(`Полка ${stamp}`);
    expect(titles).toContain(`Вторая ${stamp}`);
    expect(titles.length, "коллекция продублировалась").toBe(2);

    // Убираем из первой — вторая остаётся
    expect(
        (await context.request.delete(`${BASE_URL}/sets/${setId}/collections/${first.id}`)).status()
    ).toBe(200);

    listed = await (await context.request.get(`${BASE_URL}/sets?limit=5`)).json();
    target = (listed.sets ?? []).find((item) => item.id === setId);
    expect((target.collections ?? []).map((item) => item.title)).toEqual([`Вторая ${stamp}`]);
});

test("фильтр по коллекции отдаёт только её сеты", async ({ context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    const collection = await createCollection(context, `Фильтр ${stamp}`);
    const inside = await createSet(context, "# Внутри\n", `Внутри ${stamp}`);
    await createSet(context, "# Снаружи\n", `Снаружи ${stamp}`);

    await context.request.put(`${BASE_URL}/sets/${inside}/collections`, {
        data: { collection_id: collection.id },
    });

    const filtered = await (
        await context.request.get(`${BASE_URL}/sets?collection_id=${collection.id}`)
    ).json();
    expect(filtered.total).toBe(1);
    expect(filtered.sets[0].id).toBe(inside);

    const without = await (await context.request.get(`${BASE_URL}/sets?collection_id=0`)).json();
    expect(without.sets.every((item) => !((item.collections ?? []).length))).toBeTruthy();
});

test("дубликат названия коллекции не создаётся", async ({ context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    await createCollection(context, `Одна ${stamp}`);

    const duplicate = await context.request.post(`${BASE_URL}/collections`, {
        data: { title: `Одна ${stamp}`, color: "" },
    });
    expect(duplicate.status(), "дубликат названия должен отклоняться").toBe(409);
});

test("удаление коллекции не удаляет сеты", async ({ context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    const collection = await createCollection(context, `Временная ${stamp}`);
    const setId = await createSet(context, "# Останется\n", `Не удалять ${stamp}`);
    await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
        data: { collection_id: collection.id },
    });

    const removed = await context.request.delete(`${BASE_URL}/collections/${collection.id}`);
    expect(removed.status()).toBe(200);

    const set = await (await context.request.get(`${BASE_URL}/sets/${setId}`)).json();
    expect(set.set?.title ?? set.title).toBe(`Не удалять ${stamp}`);
});

test("личные коллекции не утекают в публичные списки", async ({ context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    const collection = await createCollection(context, `Личная ${stamp}`);
    const setId = await createSet(context, "# Публичный\n", `Публичный ${stamp}`);
    await makePublic(context, setId, `Публичный ${stamp}`);
    await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
        data: { collection_id: collection.id },
    });

    const publicSets = await (await context.request.get(`${BASE_URL}/public/sets?limit=5`)).json();
    for (const item of publicSets.sets ?? []) {
        expect(
            (item.collections ?? []).length,
            "публичный список показал коллекцию"
        ).toBe(0);
    }

    const profile = await (
        await context.request.get(`${BASE_URL}/public/users/verifyuser/sets?limit=5`)
    ).json();
    for (const item of profile.sets ?? []) {
        expect(
            (item.collections ?? []).length,
            "публичный профиль показал коллекцию"
        ).toBe(0);
    }
});

test("сайдбар группирует сеты и не теряет прокрутку", async ({ page, context }) => {
    await signIn(context);
    await resetCollections(context);

    const stamp = Date.now();
    const collection = await createCollection(context, `Группа ${stamp}`, "green");
    const setId = await createSet(context, "# В группе\n", `В группе ${stamp}`);
    await context.request.put(`${BASE_URL}/sets/${setId}/collections`, {
        data: { collection_id: collection.id },
    });

    await page.goto(`/sets/${setId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".setSidebarList", { timeout: 30 * 1000 });
    await page.waitForTimeout(2500);

    const heads = await page.locator(".setSidebarGroupHead").allInnerTexts();
    // Заголовки групп выводятся заглавными через CSS, поэтому сравниваем без учёта регистра.
    expect(
        heads.some((item) => item.toLowerCase().includes(`группа ${stamp}`))
    ).toBeTruthy();

    // Прокручиваем список и переходим по другому сету прямо в DOM: так Playwright
    // не прокручивает список сам и не мешает измерению.
    await page.evaluate(() => {
        document.querySelector(".setSidebarList").scrollTop = 200;
    });
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => document.querySelector(".setSidebarList").scrollTop);

    await page.evaluate(() => document.querySelectorAll(".setSidebarItem")[1]?.click());
    await page.waitForTimeout(2500);

    const after = await page.evaluate(() => document.querySelector(".setSidebarList").scrollTop);
    expect(before, "список не прокрутился").toBeGreaterThan(0);
    expect(after, "прокрутка списка сбросилась").toBe(before);
});

