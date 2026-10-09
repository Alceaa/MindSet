import { headingSlug, rehypeHeadingIds } from "./heading.id";

describe("headingSlug", () => {
    it("строит якорь так же, как github", () => {
        expect(headingSlug("1. Общие правила")).toBe("1-общие-правила");
        expect(headingSlug("  Заголовок   с пробелами ")).toBe("заголовок-с-пробелами");
        expect(headingSlug("Что нового?")).toBe("что-нового");
        expect(headingSlug("API_v2: настройка")).toBe("api_v2-настройка");
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