import { applyMarkdownPaste, looksLikeMarkdown } from "./paste";

describe("looksLikeMarkdown", () => {
    it("узнаёт блочную разметку", () => {
        expect(looksLikeMarkdown("## Заголовок")).toBe(true);
        expect(looksLikeMarkdown("- пункт\n- ещё пункт")).toBe(true);
        expect(looksLikeMarkdown("1. первый\n2. второй")).toBe(true);
        expect(looksLikeMarkdown("> цитата")).toBe(true);
        expect(looksLikeMarkdown("| Язык | Год |\n| --- | --- |\n| Go | 2009 |")).toBe(true);
    });

    it("узнаёт инлайн-разметку", () => {
        expect(looksLikeMarkdown("**жирный** текст")).toBe(true);
        expect(looksLikeMarkdown("ссылка [текст](https://example.com)")).toBe(true);
        expect(looksLikeMarkdown("сет [[Другой сет]]")).toBe(true);
    });

    it("обычный текст разметкой не считает", () => {
        expect(looksLikeMarkdown("просто текст без разметки")).toBe(false);
        expect(looksLikeMarkdown("")).toBe(false);
        expect(looksLikeMarkdown("   ")).toBe(false);
        expect(looksLikeMarkdown("а")).toBe(false);
    });
});

const clipboardEvent = ({ text, html }) => {
    const calls = { prevented: 0, stopped: 0 };
    const event = {
        clipboardData: {
            getData: (type) => {
                if (type === "text/plain") {
                    return text;
                }
                if (type === "text/html") {
                    return html;
                }
                return "";
            },
        },
        preventDefault: () => {
            calls.prevented += 1;
        },
        stopPropagation: () => {
            calls.stopped += 1;
        },
    };

    return { event, calls };
};

describe("applyMarkdownPaste", () => {
    it("вставляет markdown, если в буфере только текст", () => {
        const inserted = [];
        const editor = { insertMarkdown: (value) => inserted.push(value) };
        const { event, calls } = clipboardEvent({ text: "## Заголовок", html: "" });

        expect(applyMarkdownPaste(event, editor)).toBe(true);
        expect(inserted).toEqual(["## Заголовок"]);
        expect(calls.prevented).toBe(1);
        expect(calls.stopped).toBe(1);
    });

    it("не вмешивается, если в буфере есть HTML", () => {
        const editor = { insertMarkdown: () => { throw new Error("не должен вызываться"); } };
        const { event } = clipboardEvent({ text: "## Заголовок", html: "<h2>Заголовок</h2>" });

        expect(applyMarkdownPaste(event, editor)).toBe(false);
    });

    it("не вмешивается при обычном тексте", () => {
        const editor = { insertMarkdown: () => { throw new Error("не должен вызываться"); } };
        const { event } = clipboardEvent({ text: "просто текст", html: "" });

        expect(applyMarkdownPaste(event, editor)).toBe(false);
    });
});