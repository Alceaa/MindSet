import reportService from "../api/report.service";

const MAX_REPORTS = 2;
const MIN_INTERVAL = 30000;
const TOPIC = "Ошибка в браузере";
const MESSAGE_LIMIT = 2000;
const PAGE_LIMIT = 200;
const MIN_MESSAGE = 12;

// Шум и чужие ошибки: расширения, кросс-доменные скрипты, обновление сборки.
const IGNORED = [
    /^Script error\.?$/i,
    /^ResizeObserver loop/i,
    /^Loading chunk .* failed/i,
];

let sent = 0;
let lastSentAt = 0;
const seen = new Set();

const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const errorText = (error) => normalize(error?.message || error);

const buildMessage = (source, raw, error) => {
    const stack = normalize(error?.stack || "");
    return `${source}: ${raw}${stack ? `\n${stack}` : ""}`.slice(0, MESSAGE_LIMIT);
};

/**
 * Отправляет ошибку фронтенда в журнал жалоб, чтобы их было видно в админке.
 * Намеренно осторожно: не больше двух отчётов за сеанс, без повторов,
 * не чаще одного раза в 30 секунд (у эндпоинта лимит 5 запросов в час).
 */
export const reportFrontendError = (source, error) => {
    if (typeof window === "undefined" || sent >= MAX_REPORTS) {
        return;
    }

    if (navigator.onLine === false) {
        return;
    }

    const raw = errorText(error);

    if (raw.length < MIN_MESSAGE || seen.has(raw)) {
        return;
    }

    if (IGNORED.some((pattern) => pattern.test(raw))) {
        return;
    }

    const now = Date.now();
    if (now - lastSentAt < MIN_INTERVAL) {
        return;
    }

    seen.add(raw);
    lastSentAt = now;
    sent += 1;

    try {
        Promise.resolve(
            reportService.send({
                topic: TOPIC,
                message: buildMessage(source, raw, error),
                page: `${window.location.pathname}${window.location.search}`.slice(0, PAGE_LIMIT),
            })
        ).catch(() => {});
    } catch {
        return;
    }
};

export const installErrorReporting = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.addEventListener("error", (event) => {
        if (event.target && event.target !== window && event.target.tagName) {
            return;
        }
        reportFrontendError("window.onerror", event.error || event.message);
    });

    window.addEventListener("unhandledrejection", (event) => {
        reportFrontendError("unhandledrejection", event.reason);
    });
};

export default installErrorReporting;
