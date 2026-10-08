import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mindset:reader";

export const READER_DEFAULTS = {
    theme: "default",
    width: "normal",
    font: "sans",
    scale: "m",
};

export const READER_GROUPS = [
    {
        key: "theme",
        label: "Тема",
        options: [
            { value: "default", label: "Обычная" },
            { value: "sepia", label: "Сепия" },
            { value: "nord", label: "Nord" },
            { value: "contrast", label: "Контраст" },
        ],
    },
    {
        key: "width",
        label: "Ширина",
        options: [
            { value: "narrow", label: "Узкая" },
            { value: "normal", label: "Обычная" },
            { value: "wide", label: "Широкая" },
        ],
    },
    {
        key: "font",
        label: "Шрифт",
        options: [
            { value: "sans", label: "Sans" },
            { value: "serif", label: "Serif" },
        ],
    },
    {
        key: "scale",
        label: "Размер",
        options: [
            { value: "s", label: "S" },
            { value: "m", label: "M" },
            { value: "l", label: "L" },
        ],
    },
];

const readSettings = () => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return READER_DEFAULTS;
        }
        const parsed = JSON.parse(raw);
        return { ...READER_DEFAULTS, ...parsed };
    } catch {
        return READER_DEFAULTS;
    }
};

export const useReaderSettings = () => {
    const [settings, setSettings] = useState(readSettings);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch {
            return;
        }
    }, [settings]);

    const update = useCallback((key, value) => {
        setSettings((current) => ({ ...current, [key]: value }));
    }, []);

    const reset = useCallback(() => setSettings(READER_DEFAULTS), []);

    return { settings, update, reset };
};

export default useReaderSettings;