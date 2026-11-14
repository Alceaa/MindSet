import { useCallback, useEffect, useState } from "react";
import themeService from "../api/theme.service";
import { applyTheme, DEFAULT_THEME, registerThemePackages, themeByKey } from "../themes/app.themes";

const STORAGE_KEY = "mindset:theme";

// Одна тема на всё приложение: хуки подписаны на общий список слушателей,
// поэтому переключатель в настройках и MUI-тема в App.jsx не расходятся.
const listeners = new Set();
let current = null;
let catalogRequested = false;

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

/**
 * Подтягиваем библиотеку тем: она живёт на сервере, поэтому свои оформления видны на любом
 * устройстве. Если сети нет или пользователь не вошёл, остаётся кеш из localStorage —
 * применённая тема не слетает.
 */
export const syncUserThemes = async () => {
    try {
        const data = await themeService.list();
        registerThemePackages(data?.themes ?? []);
    } catch {
        // Гость или сеть недоступна: работаем с тем, что уже лежит в кеше.
    }
};

const loadThemeCatalog = async () => {
    if (catalogRequested) {
        return;
    }
    catalogRequested = true;

    await syncUserThemes();
    applyTheme(getTheme());
};

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
        loadThemeCatalog();

        return () => {
            listeners.delete(setLocalTheme);
        };
    }, []);

    useEffect(() => {
        // Аварийный выход: своя тема может получиться нечитаемой, и тогда из интерфейса
        // до кнопки не добраться — сочетание клавиш возвращает базовую тему.
        const handleKey = (event) => {
            if (!event.ctrlKey || !event.altKey || event.code !== "KeyD") {
                return;
            }

            event.preventDefault();
            setTheme(DEFAULT_THEME);
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    const reset = useCallback(() => setTheme(DEFAULT_THEME), []);

    return { theme, current: themeByKey(theme), setTheme, reset };
};

export default useAppTheme;
