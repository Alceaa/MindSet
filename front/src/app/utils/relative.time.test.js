import { formatRelativeTime } from "./relative.time";

const now = new Date("2026-10-23T12:00:00Z");

test("свежее уведомление — «только что»", () => {
    expect(formatRelativeTime("2026-10-23T11:59:30Z", now)).toBe("только что");
});

test("считает минуты и часы", () => {
    expect(formatRelativeTime("2026-10-23T11:55:00Z", now)).toBe("5 мин назад");
    expect(formatRelativeTime("2026-10-23T10:00:00Z", now)).toBe("2 ч назад");
});

test("вчера и дни", () => {
    expect(formatRelativeTime("2026-10-22T09:00:00Z", now)).toBe("вчера");
    expect(formatRelativeTime("2026-10-20T12:00:00Z", now)).toBe("3 дн назад");
});

test("давние показываем датой", () => {
    expect(formatRelativeTime("2026-10-01T10:00:00Z", now)).toBe("1 октября");
});

test("пустое и непонятное значение не ломают вывод", () => {
    expect(formatRelativeTime("", now)).toBe("");
    expect(formatRelativeTime(null, now)).toBe("");
    expect(formatRelativeTime("вчера вечером", now)).toBe("");
});
