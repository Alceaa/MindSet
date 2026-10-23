import { useEffect, useRef } from "react";

const SAVE_DELAY = 300;
const MIN_POSITION = 120;
const RESTORE_ATTEMPTS = 3;
const RESTORE_DELAY = 180;

export const readingPositionKey = (scope, id) => `mindset:read:${scope}:${id}`;

const readPosition = (key) => {
    try {
        return Number(window.localStorage.getItem(key)) || 0;
    } catch {
        return 0;
    }
};

const writePosition = (key, top) => {
    try {
        if (top < MIN_POSITION) {
            window.localStorage.removeItem(key);
            return;
        }
        window.localStorage.setItem(key, String(top));
    } catch {
        return;
    }
};

/**
 * Запоминает место чтения сета и возвращает читателя туда, где он остановился:
 * после перезагрузки страницы, повторного открытия сета и перехода «назад».
 * Восстановление повторяется, пока не сработает — картинки могут менять высоту статьи.
 */
export const useReadingPosition = ({ key, ready, enabled = true }) => {
    const restoredKeyRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!enabled || !ready || !key || restoredKeyRef.current === key) {
            return undefined;
        }

        const saved = readPosition(key);
        if (saved < MIN_POSITION) {
            restoredKeyRef.current = key;
            return undefined;
        }

        let attempts = RESTORE_ATTEMPTS;
        let timer = null;

        const scrollToSaved = () => {
            window.scrollTo({ top: saved, behavior: "auto" });

            if (attempts > 0 && Math.abs(window.scrollY - saved) > 24) {
                attempts -= 1;
                timer = window.setTimeout(scrollToSaved, RESTORE_DELAY);
                return;
            }

            restoredKeyRef.current = key;
        };

        timer = window.setTimeout(scrollToSaved, 0);

        return () => window.clearTimeout(timer);
    }, [enabled, ready, key]);

    useEffect(() => {
        if (!enabled || !ready || !key) {
            return undefined;
        }

        const save = () => writePosition(key, Math.max(0, Math.round(window.scrollY)));

        const handleScroll = () => {
            window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(save, SAVE_DELAY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.clearTimeout(timerRef.current);
            save();
        };
    }, [enabled, ready, key]);
};

export default useReadingPosition;
