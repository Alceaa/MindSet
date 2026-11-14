import React, { useEffect, useMemo, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import useAppTheme, { registerLocalTheme } from "../../hooks/use.app.theme";
import { APP_THEMES, DEFAULT_THEME } from "../../themes/app.themes";
import {
    LOCAL_THEME_KEY,
    THEME_PRESETS,
    THEME_ROLES,
    buildThemeVariables,
    contrastWarnings,
} from "../../themes/theme.roles";
import "../../css/settings/settings.scss";

const PREVIEW_SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const emptyTheme = () => ({
    title: "",
    mode: THEME_PRESETS[0].mode,
    base: THEME_PRESETS[0].base,
    roles: { ...THEME_PRESETS[0].roles },
});

/**
 * Конструктор своей темы: восемь понятных цветов вместо десятков переменных. Тема живёт
 * в профиле, модерации нет; контраст проверяем, но сохранение не запрещаем.
 */
const LocalThemeSettings = () => {
    const { theme, setTheme } = useAppTheme();
    const [form, setForm] = useState(emptyTheme);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        let alive = true;

        themeService
            .profileTheme()
            .then((data) => {
                if (!alive || !data?.theme) {
                    return;
                }

                setForm({
                    title: data.theme.title ?? "",
                    mode: data.theme.mode === "light" ? "light" : "dark",
                    base: data.theme.base || DEFAULT_THEME,
                    roles: { ...emptyTheme().roles, ...(data.theme.roles ?? {}) },
                });
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

    const preview = useMemo(() => buildThemeVariables(form.roles, form.base), [form]);
    const warnings = useMemo(() => contrastWarnings(form.roles), [form.roles]);
    const enabled = theme === LOCAL_THEME_KEY;

    const setRole = (key, value) =>
        setForm((current) => ({ ...current, roles: { ...current.roles, [key]: value } }));

    const applyPreset = (preset) =>
        setForm((current) => ({
            ...current,
            mode: preset.mode,
            base: preset.base,
            roles: { ...preset.roles },
        }));

    const save = async () => {
        setBusy(true);
        setNotice(null);

        const payload = {
            title: form.title.trim(),
            mode: form.mode,
            base: form.base,
            roles: form.roles,
        };

        try {
            await themeService.saveProfileTheme(payload);
            registerLocalTheme(payload);
            setTheme(LOCAL_THEME_KEY);
            setNotice({ kind: "success", text: "Тема сохранена и включена" });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    const clear = async () => {
        setBusy(true);
        setNotice(null);

        try {
            await themeService.clearProfileTheme();
            setForm(emptyTheme());
            setTheme(DEFAULT_THEME);
            setNotice({ kind: "success", text: "Своя тема удалена, вернулись к базовой" });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card settingsForm">
            <span className="settingsSectionLabel">Своя тема</span>
            <p className="mutedText">
                Соберите оформление под себя: восемь цветов, остальное подберётся само. Тема
                хранится в профиле, не попадает в каталог, а вернуть базовую можно кнопкой
                «Сбросить» или сочетанием Ctrl+Alt+D.
            </p>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            <div className="themePresets">
                {THEME_PRESETS.map((preset) => (
                    <button
                        key={preset.key}
                        type="button"
                        className="btn btnGhost btnSmall"
                        onClick={() => applyPreset(preset)}
                    >
                        {preset.title}
                    </button>
                ))}
            </div>

            <div className="localThemePreview" aria-hidden="true">
                {PREVIEW_SWATCHES.map((name) => (
                    <span
                        key={name}
                        className="localThemeSwatch"
                        style={{ backgroundColor: preview[name] }}
                    />
                ))}
            </div>

            <label className="settingsField">
                <span className="settingsFieldLabel">Название (необязательно)</span>
                <input
                    className="input"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    maxLength={40}
                    placeholder="Моя тема"
                />
            </label>

            <div className="localThemeRoles">
                {THEME_ROLES.map((role) => (
                    <label className="localThemeRole" key={role.key}>
                        <span className="localThemeRoleText">
                            <span className="settingsFieldLabel">{role.label}</span>
                            <span className="settingsFieldHint">{role.hint}</span>
                        </span>
                        <input
                            className="localThemeColor"
                            type="color"
                            value={form.roles[role.key]}
                            onChange={(event) => setRole(role.key, event.target.value)}
                            aria-label={`${role.label}: цвет`}
                        />
                    </label>
                ))}
            </div>

            <div className="localThemeRow">
                <label className="settingsField">
                    <span className="settingsFieldLabel">Базовая тема</span>
                    <select
                        className="input"
                        value={form.base}
                        onChange={(event) => setForm({ ...form, base: event.target.value })}
                    >
                        {APP_THEMES.map((item) => (
                            <option key={item.key} value={item.key}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="settingsField">
                    <span className="settingsFieldLabel">Тёмная или светлая</span>
                    <select
                        className="input"
                        value={form.mode}
                        onChange={(event) => setForm({ ...form, mode: event.target.value })}
                    >
                        <option value="dark">Тёмная</option>
                        <option value="light">Светлая</option>
                    </select>
                </label>
            </div>

            {warnings.length > 0 && (
                <div className="localThemeWarnings" role="status">
                    <span className="settingsFieldLabel">Проверьте читаемость</span>
                    <ul>
                        {warnings.map((item) => (
                            <li key={item.label}>{item.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="settingsActions">
                <button className="btn btnPrimary" type="button" onClick={save} disabled={busy}>
                    {busy ? "Сохраняем…" : enabled ? "Сохранить" : "Применить и сохранить"}
                </button>
                <button className="btn btnGhost" type="button" onClick={clear} disabled={busy}>
                    Сбросить
                </button>
            </div>
        </section>
    );
};

export default LocalThemeSettings;
