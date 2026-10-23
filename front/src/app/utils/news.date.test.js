import { formatNewsDate } from "./news.date";

test("показывает день и месяц по-русски", () => {
    expect(formatNewsDate("2026-10-09")).toBe("9 октября");
});

test("отбрасывает время из админского формата", () => {
    expect(formatNewsDate("2026-10-23 16:00")).toBe("23 октября");
});

test("пустое значение ничего не выводит", () => {
    expect(formatNewsDate("")).toBe("");
    expect(formatNewsDate(null)).toBe("");
    expect(formatNewsDate(undefined)).toBe("");
});

test("непонятный формат отдаём как есть", () => {
    expect(formatNewsDate("вчера")).toBe("вчера");
});
