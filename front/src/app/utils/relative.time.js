const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Время уведомления по-человечески: «только что», «5 мин назад», «вчера»,
 * а для давних — дата («13 октября»). Сервер отдаёт время в UTC по ISO.
 */
export const formatRelativeTime = (value, now = new Date()) => {
    const date = new Date(String(value ?? "").trim());
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

    if (seconds < MINUTE) {
        return "только что";
    }
    if (seconds < HOUR) {
        return `${Math.floor(seconds / MINUTE)} мин назад`;
    }
    if (seconds < DAY) {
        return `${Math.floor(seconds / HOUR)} ч назад`;
    }
    if (seconds < 2 * DAY) {
        return "вчера";
    }
    if (seconds < 7 * DAY) {
        return `${Math.floor(seconds / DAY)} дн назад`;
    }

    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

export default formatRelativeTime;
