import { stripMarkdown } from "./markdown.preview";

describe("stripMarkdown", () => {
    it("убирает HTML-теги картинок из превью", () => {
        expect(
            stripMarkdown('текст <img height="285" src="https://example.com/a.png" /> дальше')
        ).toBe("текст дальше");
    });

    it("убирает markdown-картинку и оставляет текст", () => {
        expect(stripMarkdown("до ![картинка](https://example.com/a.png) после")).toBe("до после");
    });

    it("обрезанную сущность в конце превью убирает", () => {
        expect(stripMarkdown("текст &#x2")).toBe("текст");
    });

    it("целую сущность заменяет пробелом", () => {
        expect(stripMarkdown("до&#x20;после")).toBe("до после");
    });

    it("обычный текст не портит", () => {
        expect(stripMarkdown("**Жирный** текст и [[ссылка]]")).toBe("Жирный текст и ссылка");
    });

    it("двойной дефис показывает как длинное тире", () => {
        expect(stripMarkdown("Общие правила -- кратко")).toBe("Общие правила — кратко");
    });

    it("таблицу превращает в читаемый список", () => {
        expect(stripMarkdown("| Язык | Год |\n| --- | --- |\n| Go | 2009 |")).toBe("Язык, Год; Go, 2009");
    });
});
