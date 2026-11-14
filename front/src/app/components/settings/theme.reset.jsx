import React, { useEffect } from "react";
import { DEFAULT_THEME } from "../../themes/app.themes";

const STORAGE_KEY = "mindset:theme";

/**
 * Аварийный выход из «сломанной» темы: страница /theme/reset очищает выбранную тему
 * и возвращает на главную. Нужна на случай, когда своя тема сделала интерфейс нечитаемым
 * и до кнопки в настройках не добраться.
 */
const ThemeReset = () => {
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, DEFAULT_THEME);
        } catch {
            // Приватный режим: сбрасываем хотя бы на этот раз.
        }

        window.location.replace(`${process.env.PUBLIC_URL || ""}/dashboard`);
    }, []);

    return (
        <div className="publicPage">
            <div className="publicMessage">
                <h1 className="publicMessageTitle">Возвращаем базовую тему</h1>
                <p className="mutedText">
                    Своя тема сброшена. Если она понадобится снова — соберите её в «Оформлении».
                </p>
            </div>
        </div>
    );
};

export default ThemeReset;
