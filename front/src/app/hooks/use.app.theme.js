import { useCallback, useEffect, useState } from "react";
import { applyTheme, DEFAULT_THEME, themeByKey } from "../themes/app.themes";

const STORAGE_KEY = "mindset:theme";

// Одна тема на всё приложение: хуки подписаны на общий список слушателей,
// поэтому переключатель в настройках и MUI-тема в App.jsx не расходятся.
const listeners = new Set();
let current = null;

const readTheme = () => {
    try {
        return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
};

const getTheme = () => {
    if (current === null) {
        current = readTheme();
    }
    return current;
};

export const initAppTheme = () => applyTheme(readTheme());

const setTheme = (key) => {
    current = key;
    applyTheme(key);
    try {
        window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
        // приватный режим браузера: тема просто не сохранится
    }
    listeners.forEach((listener) => listener(key));
};

/**
 * Тема приложения: хранится в localStorage и сразу применяется как набор
 * CSS-переменных на <html>, поэтому стили о конкретной теме не знают.
 */
export const useAppTheme = () => {
    const [theme, setLocalTheme] = useState(getTheme);

    useEffect(() => {
        listeners.add(setLocalTheme);
        // Применяем сразу: если тему выбрали до монтирования, вид не мигнёт.
        applyTheme(getTheme());

        return () => {
            listeners.delete(setLocalTheme);
        };
    }, []);

    const reset = useCallback(() => setTheme(DEFAULT_THEME), []);

    return { theme, current: themeByKey(theme), setTheme, reset };
};

export default useAppTheme;
