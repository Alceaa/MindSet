import React, { useCallback, useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import useAppTheme, { syncUserThemes } from "../../hooks/use.app.theme";
import { APP_THEMES, DEFAULT_THEME } from "../../themes/app.themes";
import { CUSTOM_THEME_PREFIX } from "../../themes/theme.packages";
import ThemesSettings from "./settings.themes.jsx";
import ThemeEditor from "./settings.theme.editor.jsx";

const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];
const DEFAULT_LIMIT = 10;

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
            {item.hint ? <span className="mutedText">{item.hint}</span> : null}
        </span>
    </button>
);

/**
 * Оформление: встроенные темы, библиотека своих тем и конструктор. Своя тема — это восемь
 * ролей; темы хранятся на сервере (до десяти), поэтому доступны с любого устройства, а
 * выбранная тема — в этом браузере.
 */
const AppearanceSettingsPanel = () => {
    const { theme, setTheme, reset } = useAppTheme();
    const [themes, setThemes] = useState([]);
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(0);
    // Импортированная тема: черновик для конструктора, в библиотеку он пока не попал.
    const [draft, setDraft] = useState(null);

    const reload = useCallback(async () => {
        try {
            const data = await themeService.list();
            setThemes(data?.themes ?? []);
            setLimit(data?.limit ?? DEFAULT_LIMIT);
            // Темы живут на сервере: подтягиваем их в реестр, чтобы применённая тема сразу
            // увидела свежие цвета.
            await syncUserThemes();
        } catch {
            setThemes([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const selected = themes.find((item) => item.id === selectedId) ?? null;

    const scrollToEditor = () =>
        window.setTimeout(() => {
            document
                .getElementById("themeConstructor")
                ?.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 60);

    const editTheme = (id) => {
        setDraft(null);
        setSelectedId(id);
        scrollToEditor();
    };

    const importTheme = (imported) => {
        setDraft(imported);
        setSelectedId(0);
        scrollToEditor();
    };

    // Сохранение включает тему: пользователь сохраняет то, что видит, и сразу получает результат.
    const saveTheme = async (saved) => {
        setDraft(null);
        setSelectedId(saved?.id ?? 0);
        await reload();

        if (saved?.key) {
            setTheme(`${CUSTOM_THEME_PREFIX}${saved.key}`);
        }
    };

    const removeTheme = async (id) => {
        const removed = themes.find((item) => item.id === id);

        setSelectedId(0);
        setDraft(null);
        await reload();

        if (removed && theme === `${CUSTOM_THEME_PREFIX}${removed.key}`) {
            setTheme(DEFAULT_THEME);
        }
    };

    return (
        <div className="settingsPanel">
            <div className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Оформление</h2>
                <p className="mutedText">
                    Тема применяется сразу и хранится в этом браузере: на другом устройстве свои
                    темы уже ждут, достаточно выбрать нужную в списке.
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

            <ThemeEditor
                item={selected}
                draft={draft}
                count={themes.length}
                limit={limit}
                onSaved={saveTheme}
                onDeleted={removeTheme}
            />

            <ThemesSettings
                themes={themes}
                limit={limit}
                loading={loading}
                selectedId={selectedId}
                onEdit={editTheme}
                onApplied={setTheme}
                onChanged={reload}
                onImport={importTheme}
            />
        </div>
    );
};

export default AppearanceSettingsPanel;
