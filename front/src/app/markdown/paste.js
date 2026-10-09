const MARKDOWN_SIGNS = [
    /(^|\n)\s{0,3}#{1,6}\s/,
    /(^|\n)\s{0,3}[-*+]\s+\S/,
    /(^|\n)\s{0,3}\d+\.\s+\S/,
    /(^|\n)\s{0,3}>\s?/,
    /(^|\n)\s{0,3}```/,
    /(^|\n)\s*\|.*\|\s*(\n|$)/,
    /\*\*[^*\n]+\*\*/,
    /~~[^~\n]+~~/,
    /`[^`\n]+`/,
    /\[[^\]\n]+\]\([^)\n]+\)/,
    /!\[[^\]\n]*\]\([^)\n]+\)/,
    /\[\[[^\]\n]+\]\]/,
];

export const looksLikeMarkdown = (text) => {
    const value = String(text ?? "");
    if (value.trim().length < 3) {
        return false;
    }

    return MARKDOWN_SIGNS.some((pattern) => pattern.test(value));
};

export const applyMarkdownPaste = (event, editor) => {
    const clipboard = event?.clipboardData;
    if (!clipboard || !editor) {
        return false;
    }

    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text/plain");

    if (html || !looksLikeMarkdown(text)) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();
    editor.insertMarkdown(text);

    return true;
};

export default looksLikeMarkdown;