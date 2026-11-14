import React, { useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import useAppTheme, { registerLocalTheme } from "../../hooks/use.app.theme";
import { APP_THEMES, DEFAULT_THEME, customThemeFromPackage, registeredThemes } from "../../themes/app.themes";
import ThemesSettings from "./settings.themes.jsx";
import LocalThemeSettings from "./settings.local.theme.jsx";

const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const ThemeOption = ({ item, active, onPick }) => (
    <button
        type="button"
        className={`themeOption${active ? " themeOptionActive" : ""}`}
        onClick={onPick}
        aria-pressed={active}
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
);

const AppearanceSettingsPanel = () => {
    const { theme, setTheme, reset } = useAppTheme();
    const [community, setCommunity] = useState([]);
    // Своя тема из профиля: показываем её в списке тем, если она есть.
    const [localTheme, setLocalTheme] = useState(null);

    useEffect(() => {
        let alive = true;

        themeService
            .published()
            .then((data) => {
                if (!alive) {
                    return;
                }
                setCommunity((data?.themes ?? []).map(customThemeFromPackage).filter(Boolean));
            })
            .catch(() => {});

        themeService
            .profileTheme()
            .then((data) => {
                if (!alive || !data?.theme) {
                    return;
                }

                const key = registerLocalTheme(data.theme);
                setLocalTheme(registeredThemes().find((item) => item.key === key) ?? null);
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

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
                        <ThemeOption
                            key={item.key}
                            item={item}
                            active={theme === item.key}
                            onPick={() => setTheme(item.key)}
                        />
                    ))}
                </div>
            </div>

            {localTheme && (
                <div className="settingsForm">
                    <span className="settingsSectionLabel">Своя тема</span>
                    <div className="themeOptions">
                        <ThemeOption
                            item={localTheme}
                            active={theme === localTheme.key}
                            onPick={() => setTheme(localTheme.key)}
                        />
                    </div>
                </div>
            )}

            {community.length > 0 && (
                <div className="settingsForm">
                    <span className="settingsSectionLabel">Темы сообщества</span>
                    <div className="themeOptions">
                        {community.map((item) => (
                            <ThemeOption
                                key={item.key}
                                item={item}
                                active={theme === item.key}
                                onPick={() => setTheme(item.key)}
                            />
                        ))}
                    </div>
                </div>
            )}

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

            <LocalThemeSettings />

            <ThemesSettings onApplied={setTheme} />
        </div>
    );
};

export default AppearanceSettingsPanel;
