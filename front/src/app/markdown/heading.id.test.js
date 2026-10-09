import { fixAnchorLinks, headingSlug, rehypeHeadingIds } from "./heading.id";

describe("headingSlug", () => {
    it("строит якорь так же, как github", () => {
        expect(headingSlug("1. Общие правила")).toBe("1-общие-правила");
        expect(headingSlug("  Заголовок   с пробелами ")).toBe("заголовок-с-пробелами");
        expect(headingSlug("Что нового?")).toBe("что-нового");
        expect(headingSlug("API_v2: настройка")).toBe("api_v2-настройка");
    });

    it("тире и дефисы приводит к одному виду", () => {
        expect(headingSlug("2. て-форма — て形")).toBe("2-て-форма-て形");
        expect(headingSlug("MindSet — обзор")).toBe("mindset-обзор");
        expect(headingSlug("Двойное  --  тире")).toBe("двойное-тире");
        expect(headingSlug("— Заголовок")).toBe("заголовок");
    });

    it("пустой заголовок даёт пустой якорь", () => {
        expect(headingSlug("###")).toBe("");
        expect(headingSlug("")).toBe("");
    });
});

describe("rehypeHeadingIds", () => {
    const buildTree = () => ({
        type: "root",
        children: [
            {
                type: "element",
                tagName: "h2",
                properties: {},
                children: [{ type: "text", value: "1. Общие правила" }],
            },
            {
                type: "element",
                tagName: "h2",
                properties: {},
                children: [{ type: "text", value: "1. Общие правила" }],
            },
            {
                type: "element",
                tagName: "p",
                properties: {},
                children: [{ type: "text", value: "обычный текст" }],
            },
        ],
    });

    it("проставляет id заголовкам и разводит дубликаты", () => {
        const tree = buildTree();
        rehypeHeadingIds()(tree);

        expect(tree.children[0].properties.id).toBe("1-общие-правила");
        expect(tree.children[1].properties.id).toBe("1-общие-правила-1");
        expect(tree.children[2].properties.id).toBeUndefined();
    });

    it("собирает текст заголовка из вложенных элементов", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "element",
                    tagName: "h3",
                    properties: {},
                    children: [
                        {
                            type: "element",
                            tagName: "em",
                            properties: {},
                            children: [{ type: "text", value: "Важно" }],
                        },
                        { type: "text", value: " знать" },
                    ],
                },
            ],
        };

        rehypeHeadingIds()(tree);

        expect(tree.children[0].properties.id).toBe("важно-знать");
    });
});

describe("fixAnchorLinks", () => {
    it("переписывает ссылку на реальный id заголовка", () => {
        document.body.innerHTML = [
            "<div id=\"root\">",
            "<a id=\"bad\" href=\"#2-%D1%82%D0%B5-%D1%84%D0%BE%D1%80%D0%BC%D0%B0--%D1%82%D0%B5\">ссылка</a>",
            "<a id=\"good\" href=\"#1-%D0%BE%D0%B1%D1%89%D0%B8%D0%B5\">вторая</a>",
            "<p id=\"2-те-форма-те\">цель</p>",
            "<p></p>",
            "</div>",
        ].join("");

        fixAnchorLinks(document.getElementById("root"));

        expect(document.getElementById("bad").getAttribute("href")).toBe("#2-те-форма-те");
        expect(document.getElementById("good").getAttribute("href")).toBe("#1-%D0%BE%D0%B1%D1%89%D0%B8%D0%B5");
    });
});