import { SNIPPET_GROUPS } from "./snippets";

const ITEMS = SNIPPET_GROUPS.flatMap((group) => group.items);

test("в каталоге есть группы и блоки", () => {
    expect(SNIPPET_GROUPS.length).toBeGreaterThan(0);
    expect(ITEMS.length).toBeGreaterThan(5);
});

test("у каждой группы есть ключ и название", () => {
    const broken = SNIPPET_GROUPS.filter((group) => !group.key || !group.title || !group.items.length);
    expect(broken).toEqual([]);
});

test("ключи блоков уникальны, а markdown не пустой", () => {
    const keys = ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);

    const broken = ITEMS.filter((item) => !item.title || !item.hint || !item.markdown.trim());
    expect(broken).toEqual([]);
});

test("блоки кода закрыты парными ограждениями", () => {
    const fences = ITEMS.filter((item) => item.markdown.includes("```"));
    const odd = fences.filter((item) => item.markdown.split("```").length % 2 === 0);

    expect(fences.length).toBeGreaterThan(0);
    expect(odd).toEqual([]);
});
