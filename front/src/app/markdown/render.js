import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { rehypeHeadingIds } from "./heading.id.js";
import remarkGfm from "remark-gfm";
import { remarkDashes } from "./typography.js";
import { BOARD_PROTOCOL } from "./wikilink.js";

export const WIKILINK_PROTOCOL = "wikilink";

// Редактор (MDXEditor) хранит картинки HTML-тегом <img height width />, поэтому
// сырой HTML нужно разбирать — но только безопасный: rehype-sanitize вырезает
// скрипты и обработчики событий, оставляя картинки и ссылки.
export const sanitizeSchema = {
    ...defaultSchema,
    // Редактор хранит подчёркивание HTML-тегом <u>, а в схеме GitHub его нет — добавляем,
    // иначе подчёркнутый текст терял оформление после сохранения.
    tagNames: [...(defaultSchema.tagNames ?? []), "u"],
    protocols: {
        ...defaultSchema.protocols,
        // wikilink — ссылка на сет, board — на доску: и то и другое подставляем сами.
        href: [...(defaultSchema.protocols?.href ?? []), WIKILINK_PROTOCOL, BOARD_PROTOCOL],
    },
    attributes: {
        ...defaultSchema.attributes,
        // Без этого санитайз вырезает класс language-* у блока кода, и подсветка
        // не знает язык. Разрешаем только такие классы — произвольные по-прежнему нет.
        code: [["className", /^language-./]],
        img: [
            ...(defaultSchema.attributes?.img ?? []),
            "src",
            "alt",
            "title",
            "width",
            "height",
            "loading",
        ],
    },
};

// Якоря заголовков добавляем после санитайза: иначе он приписал бы к id префикс
// user-content- и ссылки вида [текст](#якорь) не находили бы цель.
export const remarkPlugins = [remarkGfm, remarkDashes];

export const rehypePlugins = [rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeHeadingIds];

export default rehypePlugins;
