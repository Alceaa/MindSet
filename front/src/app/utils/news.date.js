const MONTH_FORMAT = { day: "numeric", month: "long" };

/**
 * Дата новости в человеческом виде: «9 октября».
 * Принимает и «2026-10-09», и «2026-10-23 16:00» (формат из админки),
 * непонятное значение возвращает как есть.
 */
export const formatNewsDate = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return "";
    }

    const normalized = raw.includes(" ") ? raw.replace(" ", "T") : `${raw}T00:00`;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return raw;
    }

    return date.toLocaleDateString("ru-RU", MONTH_FORMAT);
};

export default formatNewsDate;
