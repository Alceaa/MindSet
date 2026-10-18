import { simplifyMarkdown } from "./simplify";

describe("simplifyMarkdown", () => {
    it("убирает details и делает summary жирным", () => {
        expect(simplifyMarkdown("<details><summary>Спойлер</summary>\n\nТекст\n\n</details>")).toBe("**Спойлер**\n\nТекст");
    });

    it("картинку переводит в markdown", () => {
        expect(
            simplifyMarkdown('<img height="120" width="200" src="https://example.com/a.png" alt="схема" />')
        ).toBe("![схема](https://example.com/a.png)");
    });

    it("лишние теги убирает, br превращает в перенос", () => {
        expect(simplifyMarkdown("до<br>после <span>текст</span>")).toBe("до\nпосле текст");
    });

    it("внутри кода ничего не трогает", () => {
        const source = '```go\nif a < b {\n\tfmt.Println("<div>")\n}\n```\n\nи `a < b`';
        expect(simplifyMarkdown(source)).toBe(source);
    });

    it("обычный markdown не меняет", () => {
        expect(simplifyMarkdown("# Заголовок\n\nтекст")).toBe("# Заголовок\n\nтекст");
    });
});