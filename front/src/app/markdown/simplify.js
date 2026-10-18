const STASH = "\u0000";

const attribute = (tag, name) => {
    const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
    return match ? match[2] ?? match[3] ?? "" : "";
};

export const simplifyMarkdown = (markdown) => {
    const stashed = [];
    const keep = (value) => {
        stashed.push(value);
        return `${STASH}${stashed.length - 1}${STASH}`;
    };

    let text = String(markdown ?? "")
        .replace(/```[\s\S]*?```/g, keep)
        .replace(/~~~[\s\S]*?~~~/g, keep)
        .replace(/`[^`\n]*`/g, keep);

    text = text
        .replace(/<\/?details[^>]*>/gi, "")
        .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, (match, inner) => `**${inner.trim()}**`)
        .replace(/<img\b[^>]*>/gi, (tag) => {
            const src = attribute(tag, "src");
            const alt = attribute(tag, "alt");
            return src ? `![${alt}](${src})` : "";
        })
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[a-zA-Z][^>]*>/g, "")
        .replace(/\n{3,}/g, "\n\n");

    return text
        .replace(new RegExp(`${STASH}(\\d+)${STASH}`, "g"), (match, index) => stashed[Number(index)])
        .trim();
};

export default simplifyMarkdown;