import { remarkDashes, replaceDashes } from "./typography";
import { headingSlug } from "./heading.id";

describe("replaceDashes", () => {
    it("двойной дефис превращает в длинное тире", () => {
        expect(replaceDashes("А -- Б")).toBe("А — Б");
        expect(replaceDashes("слово---слово")).toBe("слово—слово");
    });

    it("одиночный дефис не трогает", () => {
        expect(replaceDashes("что-то и 1-2")).toBe("что-то и 1-2");
    });

    it("результат сходится с якорем заголовка", () => {
        expect(headingSlug(replaceDashes("2. て-форма -- て形"))).toBe("2-て-форма-て形");
    });
});

describe("remarkDashes", () => {
    const buildTree = () => ({
        type: "root",
        children: [
            { type: "paragraph", children: [{ type: "text", value: "до -- после" }] },
            {
                type: "paragraph",
                children: [
                    { type: "inlineCode", value: "--help" },
                    { type: "text", value: " и текст" },
                ],
            },
            { type: "code", lang: "sh", value: "ls --all" },
            { type: "link", url: "https://example.com/a--b", children: [{ type: "text", value: "ссылка" }] },
        ],
    });

    it("меняет текст, но не код", () => {
        const tree = buildTree();
        remarkDashes()(tree);

        expect(tree.children[0].children[0].value).toBe("до — после");
        expect(tree.children[1].children[0].value).toBe("--help");
        expect(tree.children[1].children[1].value).toBe(" и текст");
        expect(tree.children[2].value).toBe("ls --all");
        expect(tree.children[3].url).toBe("https://example.com/a--b");
        expect(tree.children[3].children[0].value).toBe("ссылка");
    });
});