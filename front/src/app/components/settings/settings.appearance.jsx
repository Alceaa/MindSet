import React, { useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import useAppTheme from "../../hooks/use.app.theme";
import { useAuth } from "../../context/auth.context";
import { APP_THEMES, DEFAULT_THEME, customThemeFromPackage } from "../../themes/app.themes";
import ThemesSettings from "./settings.themes.jsx";
import LocalThemeSettings from "./settings.local.theme.jsx";

const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const ThemeOption = ({ item, active, badge, onPick }) => (
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
            <span className="settingsRowTitle">
                {item.label}
                {badge ? <span className="themeOptionBadge">{badge}</span> : null}
            </span>
            <span className="mutedText">{item.hint}</span>
        </span>
    </button>
);

const AppearanceSettingsPanel = () => {
    const { theme, setTheme, reset } = useAppTheme();
    const { user } = useAuth();
    const [community, setCommunity] = useState([]);

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

        return () => {
            alive = false;
        };
    }, []);

    // Своя тема живёт в том же списке, что и темы сообщества: после публикации она приходит
    // карточкой оттуда, поэтому отдельной карточки нет — только пометка «ваша».
    const isOwn = (item) =>
        Boolean(user?.login) && item.author.toLowerCase() === user.login.toLowerCase();

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

            {community.length > 0 && (
                <div className="settingsForm">
                    <span className="settingsSectionLabel">Темы сообщества</span>
                    <div className="themeOptions">
                        {community.map((item) => (
                            <ThemeOption
                                key={item.key}
                                item={item}
                                active={theme === item.key}
                                badge={isOwn(item) ? "ваша" : ""}
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
