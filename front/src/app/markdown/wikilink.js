export const normalizeTitle = (title) =>
    title.toLowerCase().split(/\s+/).filter(Boolean).join(" ");

// Ссылка на доску: [[board:Схема деплоя]] или [[доска:Схема деплоя|схема]].
// Протокол отличается от викиссылки, чтобы доска была отдельным типом вложения,
// а не ещё одним сетом.
export const BOARD_PROTOCOL = "board";

const BOARD_PREFIX = /^(?:board|доска)\s*:\s*/i;

/**
 * Разбор того, что набрано в пикере ссылок. `[[board:Схема` — это явно доска,
 * поэтому искать нужно по «Схема», а не по всей строке с префиксом.
 */
export const parseBoardQuery = (raw) => {
    const text = String(raw ?? "");
    const match = BOARD_PREFIX.exec(text);

    if (!match) {
        return { board: false, needle: text.trim() };
    }

    return { board: true, needle: text.slice(match[0].length).trim() };
};

const STASH = "\u0001";
const ANY_OPEN = /\\?\[\\?\[/;
const WIKILINK = /\\?\[\\?\[([^[\]\n]*?)\\?\]\\?\]/g;
const ESCAPED_PUNCTUATION = /\\([!-/:-@[-`{-~])/g;
const HEX_ENTITY = /&#x([0-9a-f]{1,6});/gi;
const DECIMAL_ENTITY = /&#(\d{1,7});/g;
const NAMED_ENTITY = /&(lt|gt|quot|apos|nbsp|amp);/g;

const NAMED_CHARACTERS = {
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
    amp: "&",
};

export const stripEscapes = (value) =>
    String(value ?? "").replace(ESCAPED_PUNCTUATION, "$1");

const characterReference = (match, raw, radix) => {
    const code = Number.parseInt(raw, radix);

    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        return match;
    }

    return String.fromCodePoint(code);
};

const decodeEntities = (text) =>
    text
        .replace(HEX_ENTITY, (match, raw) => characterReference(match, raw, 16))
        .replace(DECIMAL_ENTITY, (match, raw) => characterReference(match, raw, 10))
        .replace(NAMED_ENTITY, (match, name) => NAMED_CHARACTERS[name] ?? match);

export const prepareMarkdown = (markdown) => {
    const code = [];

    const stash = (value) => {
        code.push(value);
        return `${STASH}${code.length - 1}${STASH}`;
    };

    let text = decodeEntities(
        String(markdown ?? "")
            .replace(/\r\n?/g, "\n")
            .replace(/```[\s\S]*?```/g, stash)
            .replace(/`[^`\n]*`/g, stash)
    );

    // Превью на сервере режется по длине, поэтому в конце может оказаться
    // половина сущности («&#x2») — такой хвост не текст, его убираем.
    text = text.replace(/\s*&#x?[0-9a-f]{0,6}$/i, "");

    const stashLinks = [];
    const convert = (match, raw) => {
        const pipe = raw.indexOf("|");
        const label = (pipe === -1 ? raw : raw.slice(0, pipe)).trim();
        const alias = pipe === -1 ? "" : raw.slice(pipe + 1).trim();

        // Доска подставляется по названию, как сет по викиссылке.
        const board = BOARD_PREFIX.exec(label);
        if (board) {
            const boardTitle = label.slice(board[0].length).trim();
            const boardKey = normalizeTitle(stripEscapes(boardTitle));

            if (!boardKey) {
                return match;
            }

            stashLinks.push({ protocol: BOARD_PROTOCOL, key: boardKey });
            return (
                STASH +
                "L" +
                (stashLinks.length - 1) +
                STASH +
                "(" +
                (alias || boardTitle) +
                ")"
            );
        }

        const key = normalizeTitle(stripEscapes(label));

        if (!key) {
            return match;
        }

        stashLinks.push({ protocol: "wikilink", key });
        return (
            STASH +
            "L" +
            (stashLinks.length - 1) +
            STASH +
            "(" +
            (alias || label) +
            ")"
        );
    };

    let guard = 0;
    while (ANY_OPEN.test(text) && guard < 50) {
        guard += 1;
        const snapshot = text;
        text = text.replace(WIKILINK, convert);
        if (text === snapshot) {
            break;
        }
    }

    text = text.replace(
        new RegExp(`${STASH}L(\\d+)${STASH}\\(([^)]*)\\)`, "g"),
        (match, index, label) => {
            const link = stashLinks[Number(index)];
            return "[" + label + "](" + link.protocol + ":" + encodeURIComponent(link.key) + ")";
        }
    );

    return text.replace(new RegExp(`${STASH}(\\d+)${STASH}`, "g"), (match, index) =>
        code[Number(index)]
    );
};

export default prepareMarkdown;