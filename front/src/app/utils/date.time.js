/**
 * Момент времени в часовом поясе пользователя: «2026-10-29 19:43».
 *
 * Сервер отдаёт время в UTC по ISO («2026-10-29T16:43:00Z»), и показывать его как есть
 * нельзя: сервер стоит в другой стране, поэтому время приглашений и репортов уезжало на
 * часы. Браузер сам переводит момент в часовой пояс смотрящего.
 *
 * Понимаем и старый формат без пояса («2026-10-29 16:43») — считаем его UTC.
 */
export const formatDateTime = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return "";
    }

    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)
        ? `${raw.replace(" ", "T")}:00Z`
        : raw;

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        return raw;
    }

    const pad = (number) => String(number).padStart(2, "0");

    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
};

export default formatDateTime;
