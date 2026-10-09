import { stripEscapes } from "../markdown/wikilink";

export function stripMarkdown(markdown) {
    if (!markdown) {
        return "";
    }

    return stripEscapes(String(markdown))
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (row, inner) =>
            /^[\s:|-]+$/.test(inner)
                ? ""
                : `${inner
                      .split("|")
                      .map((cell) => cell.trim())
                      .filter(Boolean)
                      .join(", ")}; `
        )
        .replace(/<[^>\n]*>/g, " ")
        // Превью обрезается (сервер режет по 280 символов, карточка — по 400),
        // поэтому сущность может прийти обрезанной: «&#x20;» без хвоста.
        .replace(/&#x[0-9a-f]{0,6};?|&#\d{0,7};?/gi, " ")
        .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-+*]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/[*_~]{1,3}/g, "")
        .replace(/---+/g, " ")
        .replace(/--+/g, "—")
        .replace(/\n{2,}/g, "\n")
        .replace(/\s+/g, " ")
        .replace(/[;\s]+$/g, "")
        .trim();
}

export default stripMarkdown;
