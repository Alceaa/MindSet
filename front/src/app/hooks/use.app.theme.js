import { useCallback, useEffect, useState } from "react";
import themeService from "../api/theme.service";
import { applyTheme, DEFAULT_THEME, registerThemePackages, themeByKey } from "../themes/app.themes";
import { LOCAL_THEME_KEY, localThemePackage } from "../themes/theme.roles";

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

const loadThemeCatalog = async () => {
    if (catalogRequested) {
        return;
    }
    catalogRequested = true;

    try {
        const data = await themeService.published();
        registerThemePackages(data?.themes ?? []);
    } catch {
        catalogRequested = false;
    }

    // Своя тема из профиля: она не в каталоге, поэтому грузится отдельно.
    try {
        const local = await themeService.profileTheme();
        if (local?.theme) {
            registerThemePackages([localThemePackage(local.theme)]);
        }
    } catch {
        // Или гость, или темы нет — оба случая нормальные.
    }

    applyTheme(getTheme());
};

/**
 * Своя тема пользователя: конструктор в настройках сохраняет роли в профиль,
 * а здесь они подставляются в реестр тем под ключом local.
 */
export const registerLocalTheme = (theme) => {
    registerThemePackages([localThemePackage(theme)]);
    return LOCAL_THEME_KEY;
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
