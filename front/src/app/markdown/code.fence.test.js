import { normalizeCodeFences } from "./code.fence";

// Так выглядит фенс, набранный в обычном режиме: каждый бэктик экранирован.
const escapedFence = (language = "") => `\\\`\\\`\\\`${language}`;

describe("normalizeCodeFences", () => {
    it("собирает блок кода, набранный текстом, в настоящий фенс", () => {
        const typed = [escapedFence(), "", "fmt.Println(1)", "", escapedFence()].join("\n");

        expect(normalizeCodeFences(typed)).toBe("```\nfmt.Println(1)\n```");
    });

    it("сохраняет язык блока", () => {
        const typed = [escapedFence("go"), "", "func main() {}", "", escapedFence()].join("\n");

        expect(normalizeCodeFences(typed)).toBe("```go\nfunc main() {}\n```");
    });

    it("снимает экранирование внутри кода", () => {
        const typed = [
            escapedFence(),
            "",
            "if a \\* b \\_ c {",
            "",
            "arr\\[0\\] = \\`x\\`",
            "",
            escapedFence(),
        ].join("\n");

        expect(normalizeCodeFences(typed)).toBe("```\nif a * b _ c {\narr[0] = `x`\n```");
    });

    it("оставляет пустые строки внутри кода", () => {
        const typed = [
            escapedFence(),
            "",
            "строка 1",
            "",
            "",
            "",
            "строка 2",
            "",
            escapedFence(),
        ].join("\n");

        expect(normalizeCodeFences(typed)).toBe("```\nстрока 1\n\nстрока 2\n```");
    });

    it("разбирает несколько блоков подряд", () => {
        const typed = [
            escapedFence("go"),
            "",
            "первый",
            "",
            escapedFence(),
            "",
            "между блоками",
            "",
            escapedFence(),
            "",
            "второй",
            "",
            escapedFence(),
        ].join("\n");

        expect(normalizeCodeFences(typed)).toBe(
            "```go\nпервый\n```\n\nмежду блоками\n\n```\nвторой\n```"
        );
    });

    it("не трогает настоящий фенс вместе с содержимым", () => {
        const markdown = "```go\nfunc main() {}\n```";

        expect(normalizeCodeFences(markdown)).toBe(markdown);
    });

    it("не трогает настоящий фенс рядом с текстовым", () => {
        const typed = [
            "```js",
            "const a = 1;",
            "```",
            "",
            escapedFence(),
            "",
            "текст",
            "",
            escapedFence(),
        ].join("\n");

        expect(normalizeCodeFences(typed)).toBe(
            "```js\nconst a = 1;\n```\n\n```\nтекст\n```"
        );
    });

    it("не трогает тильдовый фенс", () => {
        const markdown = "~~~\nкод\n~~~";

        expect(normalizeCodeFences(markdown)).toBe(markdown);
    });

    it("не трогает текст без бэктиков и одиночные бэктики", () => {
        expect(normalizeCodeFences("обычный текст")).toBe("обычный текст");
        expect(normalizeCodeFences("текст с \\`\\` двумя бэктиками")).toBe(
            "текст с \\`\\` двумя бэктиками"
        );
        expect(normalizeCodeFences("\\`код\\` в строке")).toBe("\\`код\\` в строке");
    });

    it("не трогает незакрытый фенс", () => {
        const typed = [escapedFence(), "", "код без закрывающего фенса"].join("\n");

        expect(normalizeCodeFences(typed)).toBe(typed);
    });

    it("не трогает код с незакрытым настоящим фенсом", () => {
        const markdown = "```go\nfunc main() {}";

        expect(normalizeCodeFences(markdown)).toBe(markdown);
    });

    it("считает фенс с четырьмя бэктиками", () => {
        const typed = ["\\`\\`\\`\\`", "", "код", "", "\\`\\`\\`\\`"].join("\n");

        expect(normalizeCodeFences(typed)).toBe("```\nкод\n```");
    });

    it("работает с переводами строк Windows", () => {
        const typed = [escapedFence(), "", "код", "", escapedFence()].join("\r\n");

        expect(normalizeCodeFences(typed)).toBe("```\nкод\n```");
    });

    it("идемпотентна: повторный проход ничего не меняет", () => {
        const typed = [escapedFence("go"), "", "func main() {}", "", escapedFence()].join("\n");
        const once = normalizeCodeFences(typed);

        expect(normalizeCodeFences(once)).toBe(once);
    });

    it("не падает на пустом значении", () => {
        expect(normalizeCodeFences("")).toBe("");
        expect(normalizeCodeFences(null)).toBe("");
        expect(normalizeCodeFences(undefined)).toBe("");
    });
});
