const DASHES = /--+/g;

export const replaceDashes = (value) => String(value ?? "").replace(DASHES, "—");

export const remarkDashes = () => (tree) => {
    const walk = (node, insideCode) => {
        if (!node || typeof node !== "object") {
            return;
        }

        const code = insideCode || node.type === "code" || node.type === "inlineCode";

        if (!code && node.type === "text") {
            node.value = replaceDashes(node.value);
            return;
        }

        if (Array.isArray(node.children)) {
            node.children.forEach((child) => walk(child, code));
        }
    };

    walk(tree, false);
};

export default remarkDashes;