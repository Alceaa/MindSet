// Превращает markdown в короткий плоский текст для превью в карточках сетов.
import { stripEscapes } from "../markdown/wikilink";

export function stripMarkdown(markdown) {
    if (!markdown) {
        return "";
    }

    // Сначала снимаем экранирование (\[\[ -> [[, \* -> * и т.п.),
    // иначе regex-очистка не распознаёт экранированные конструкции.
    return stripEscapes(String(markdown))
        .replace(/```[\s\S]*?```/g, " ")
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
        .replace(/\n{2,}/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

export default stripMarkdown;
