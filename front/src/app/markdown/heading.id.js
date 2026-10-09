const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const PUNCTUATION = /[^\p{L}\p{N}\s_-]/gu;

export const headingSlug = (text) =>
    String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(PUNCTUATION, "")
        .replace(/\s+/g, "-");

const collectText = (node) => {
    if (!node || typeof node !== "object") {
        return "";
    }
    if (node.type === "text") {
        return node.value ?? "";
    }
    if (Array.isArray(node.children)) {
        return node.children.map(collectText).join("");
    }
    return "";
};

export const rehypeHeadingIds = () => (tree) => {
    const used = new Map();

    const walk = (node) => {
        if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
            return;
        }

        if (node.type === "element" && HEADINGS.has(node.tagName)) {
            const slug = headingSlug(collectText(node));

            if (slug) {
                const seen = used.get(slug) ?? 0;
                used.set(slug, seen + 1);
                node.properties = {
                    ...(node.properties ?? {}),
                    id: seen === 0 ? slug : `${slug}-${seen}`,
                };
            }
        }

        node.children.forEach(walk);
    };

    walk(tree);
};

export default rehypeHeadingIds;