import React from "react";
import { APP_THEMES, DEFAULT_THEME } from "../../themes/app.themes";
import useAppTheme from "../../hooks/use.app.theme";

// Тема — это данные: панель просто перебирает их и показывает образцы цветов.
const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const AppearanceSettingsPanel = () => {
    const { theme, setTheme, reset } = useAppTheme();

    return (
        <div className="settingsPanel">
            <div className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Оформление</h2>
                <p className="mutedText">
                    Тема применяется сразу и хранится в этом браузере — на других устройствах
                    её можно выбрать отдельно.
                </p>
            </div>

            <div className="settingsForm">
                <span className="settingsSectionLabel">Тема</span>
                <div className="themeOptions">
                    {APP_THEMES.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`themeOption${
                                theme === item.key ? " themeOptionActive" : ""
                            }`}
                            onClick={() => setTheme(item.key)}
                            aria-pressed={theme === item.key}
                        >
                            <span className="themeOptionSwatches" aria-hidden="true">
                                {SWATCHES.map((name) => (
                                    <span
                                        key={name}
                                        className="themeOptionSwatch"
                                        style={{ backgroundColor: item.variables[name] }}
                                    />
                                ))}
                            </span>
                            <span className="themeOptionText">
                                <span className="settingsRowTitle">{item.label}</span>
                                <span className="mutedText">{item.hint}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="settingsActions">
                <button
                    type="button"
                    className="btn btnGhost"
                    onClick={reset}
                    disabled={theme === DEFAULT_THEME}
                >
                    Вернуть тему по умолчанию
                </button>
            </div>
        </div>
    );
};

export default AppearanceSettingsPanel;
