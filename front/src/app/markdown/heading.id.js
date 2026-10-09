import { useEffect } from "react";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const PUNCTUATION = /[^\p{L}\p{N}\s_-]/gu;
const TYPOGRAPHIC_DASHES = /[\u2010-\u2015\u2212]/g;

export const headingSlug = (text) =>
    String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(TYPOGRAPHIC_DASHES, "-")
        .replace(PUNCTUATION, "")
        .replace(/[\s-]+/g, "-")
        .replace(/^-+|-+$/g, "");

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

export const fixAnchorLinks = (root) => {
    if (!root || typeof root.querySelectorAll !== "function" || typeof document === "undefined") {
        return;
    }

    root.querySelectorAll("a[href^='#']").forEach((link) => {
        const href = link.getAttribute("href") || "";

        let raw = href.slice(1);
        try {
            raw = decodeURIComponent(raw);
        } catch (error) {
            return;
        }

        if (!raw || document.getElementById(raw)) {
            return;
        }

        const slug = headingSlug(raw);
        if (slug && slug !== raw && document.getElementById(slug)) {
            link.setAttribute("href", `#${slug}`);
        }
    });
};

export const useAnchorLinks = (ref, dependency) => {
    useEffect(() => {
        fixAnchorLinks(ref.current);
    }, [ref, dependency]);
};

export default rehypeHeadingIds;