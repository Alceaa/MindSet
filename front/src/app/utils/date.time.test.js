import { formatDateTime } from "./date.time";

const instant = "2026-10-29T16:43:00Z";

test("показывает тот же момент, но в поясе пользователя", () => {
    const shown = formatDateTime(instant);

    expect(new Date(shown.replace(" ", "T")).getTime()).toBe(new Date(instant).getTime());
});

test("совпадает с локальным временем браузера", () => {
    const date = new Date(instant);
    const pad = (number) => String(number).padStart(2, "0");

    expect(formatDateTime(instant)).toBe(
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
});

test("старый формат без пояса считаем UTC", () => {
    expect(formatDateTime("2026-10-29 16:43")).toBe(formatDateTime(instant));
});

test("пустое значение ничего не выводит", () => {
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
});

test("непонятный формат отдаём как есть", () => {
    expect(formatDateTime("вчера")).toBe("вчера");
});
