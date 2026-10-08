import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

export const WIKILINK_PROTOCOL = "wikilink";

// Редактор (MDXEditor) хранит картинки HTML-тегом <img height width />, поэтому
// сырой HTML нужно разбирать — но только безопасный: rehype-sanitize вырезает
// скрипты и обработчики событий, оставляя картинки и ссылки.
export const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
        ...defaultSchema.protocols,
        href: [...(defaultSchema.protocols?.href ?? []), WIKILINK_PROTOCOL],
    },
    attributes: {
        ...defaultSchema.attributes,
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

export const rehypePlugins = [rehypeRaw, [rehypeSanitize, sanitizeSchema]];

export default rehypePlugins;
