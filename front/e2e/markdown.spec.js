// Разметка заметок: подчёркивание и маркеры списка должны доживать до статьи.
//
// Проверка появилась после двух багов: санитайзер вырезал тег <u> (подчёркнутый текст
// терял оформление после сохранения), а редактор менял маркеры списка с «-» на «*».
const { test, expect } = require("@playwright/test");
const {
    signIn,
    createSet,
    fetchSetContent,
    openPage,
    appendToText,
    saveSet,
} = require("./helpers");

test("подчёркнутый текст виден в статье", async ({ page, context }) => {
    await signIn(context);
    const id = await createSet(context, "Подчёркнутый: <u>важный текст</u>.\n");

    await openPage(page, `/sets/${id}`, ".article");

    await expect(page.locator(".article u")).toHaveText("важный текст");
});

test("подчёркивание работает вместе с жирным", async ({ page, context }) => {
    await signIn(context);
    const id = await createSet(context, "И то и другое: **<u>важный текст</u>**.\n");

    await openPage(page, `/sets/${id}`, ".article");

    await expect(page.locator(".article strong u")).toHaveText("важный текст");
});

test("правка заметки не теряет подчёркивание", async ({ page, context }) => {
    await signIn(context);
    const id = await createSet(context, "Подчёркнутый: <u>важный текст</u>.\n");

    await page.goto(`/sets/${id}?mode=edit`, { waitUntil: "domcontentloaded" });
    await appendToText(page, "важный текст", "!");
    await saveSet(page);

    const content = await fetchSetContent(context, id);
    expect(content, "тег <u> пропал после сохранения").toContain("<u>");
    expect(content).toContain("важный текст");
});

test("правка заметки не меняет маркеры списка", async ({ page, context }) => {
    await signIn(context);
    const id = await createSet(context, "- один\n- два\n- три\n");

    await page.goto(`/sets/${id}?mode=edit`, { waitUntil: "domcontentloaded" });
    await appendToText(page, "один", "!");
    await saveSet(page);

    const content = await fetchSetContent(context, id);
    expect(content, "маркер списка заменился").not.toContain("* один");
    expect(content).toContain("- один!");
    expect(content).toContain("- два");
    expect(content).toContain("- три");
});
