import React, { useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import useAppTheme, { registerLocalTheme } from "../../hooks/use.app.theme";
import { APP_THEMES, DEFAULT_THEME, isCustomTheme, themeByKey } from "../../themes/app.themes";
import { CUSTOM_THEME_PREFIX } from "../../themes/theme.packages";
import {
    LOCAL_THEME_KEY,
    THEME_PRESETS,
    packageVariables,
    rolesFromVariables,
} from "../../themes/theme.roles";
import ThemeRolesFields from "./theme.roles.fields.jsx";
import "../../css/settings/settings.scss";

const emptyTheme = () => ({
    title: "",
    description: "",
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

    // Если включена тема из каталога, конструктор показывает её цвета — правку видно глазами.
    // Иначе показываем свою тему из профиля.
    useEffect(() => {
        let alive = true;

        const ownPackages = async () =>
            (await themeService.own().catch(() => null))?.themes ?? [];

        const fillFromProfile = async () => {
            const data = await themeService.profileTheme().catch(() => null);

            if (!alive || !data?.theme) {
                return;
            }

            const title = data.theme.title ?? "";
            const packages = await ownPackages();

            if (!alive) {
                return;
            }

            // Описание живёт в каталоге, а не в профиле: берём у своей темы с тем же названием.
            const twin = packages.find((item) => (item.title ?? "").trim() === title.trim());

            setForm({
                title,
                description: twin?.description ?? "",
                mode: data.theme.mode === "light" ? "light" : "dark",
                base: data.theme.base || DEFAULT_THEME,
                roles: { ...emptyTheme().roles, ...(data.theme.roles ?? {}) },
            });
        };

        const fillFromApplied = async () => {
            const applied = themeByKey(theme);
            const packages = await ownPackages();

            if (!alive) {
                return;
            }

            const mine = packages.find((item) => `${CUSTOM_THEME_PREFIX}${item.key}` === theme);

            setForm({
                // Чужую тему не подписываем её названием: это уже своя тема, автор назовёт её сам.
                title: mine ? mine.title : "",
                description: mine?.description ?? "",
                mode: applied.mode === "light" ? "light" : "dark",
                base: mine?.base || applied.base || DEFAULT_THEME,
                roles: rolesFromVariables(applied.variables),
            });
        };

        if (isCustomTheme(theme) && theme !== LOCAL_THEME_KEY) {
            fillFromApplied();
        } else {
            fillFromProfile();
        }

        return () => {
            alive = false;
        };
    }, [theme]);

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

    // Базовая тема — это стартовая точка: берём из неё режим и восемь цветов, а дальше их правят
    // руками. Иначе выбор базы влиял только на тени и подсветку кода, и казалось, что он мёртвый.
    const applyBase = (key) => {
        const baseTheme = themeByKey(key);

        setForm((current) => ({
            ...current,
            base: key,
            mode: baseTheme.mode === "light" ? "light" : "dark",
            roles: rolesFromVariables(baseTheme.variables),
        }));
    };

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

    /**
     * Отправка в каталог: конструктор один, поэтому тема для сообщества собирается из этой же
     * своей темы. Если тема с таким названием уже есть у автора — правим её (опубликованная
     * правка уходит на модерацию), иначе создаём и сразу отправляем на проверку.
     */
    const submitToCatalog = async () => {
        setBusy(true);
        setNotice(null);

        const payload = {
            title: form.title.trim() || "Своя тема",
            description: form.description.trim(),
            mode: form.mode,
            base: form.base,
            variables: packageVariables(form.roles, form.base),
        };

        try {
            await themeService.saveProfileTheme({
                title: form.title.trim(),
                mode: form.mode,
                base: form.base,
                roles: form.roles,
            });
            registerLocalTheme({ title: form.title.trim(), mode: form.mode, base: form.base, roles: form.roles });
            setTheme(LOCAL_THEME_KEY);

            const own = await themeService.own();
            const existing = (own?.themes ?? []).find((item) => item.title === payload.title);

            if (!existing) {
                const created = await themeService.create(payload);
                await themeService.submit(created?.theme?.id);
                setNotice({ kind: "success", text: "Тема отправлена на модерацию" });
            } else if (existing.status === "approved") {
                await themeService.update(existing.id, payload);
                setNotice({
                    kind: "success",
                    text: "Правка отправлена на модерацию: в каталоге пока прежняя версия",
                });
            } else if (existing.status === "pending") {
                setNotice({ kind: "error", text: "Тема с таким названием уже на модерации" });
            } else {
                await themeService.update(existing.id, payload);
                await themeService.submit(existing.id);
                setNotice({ kind: "success", text: "Тема отправлена на модерацию" });
            }
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
        <section className="card settingsForm" id="themeConstructor">
            <span className="settingsSectionLabel">Конструктор темы</span>
            <p className="mutedText">
                Соберите оформление под себя: восемь цветов, остальное подберётся само. Тема
                хранится в профиле, а вернуть базовую можно кнопкой «Сбросить» или сочетанием
                Ctrl+Alt+D. Если включена тема из каталога, конструктор показывает её цвета:
                правьте и отправляйте правку на модерацию.
            </p>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            <ThemeRolesFields
                roles={form.roles}
                base={form.base}
                onRole={setRole}
                onPreset={applyPreset}
            />

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

            <label className="settingsField">
                <span className="settingsFieldLabel">Описание (необязательно)</span>
                <input
                    className="input"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    maxLength={200}
                    placeholder="Пара слов для каталога"
                />
            </label>

            <div className="localThemeRow">
                <label className="settingsField">
                    <span className="settingsFieldLabel">Базовая тема</span>
                    <select
                        className="input"
                        value={form.base}
                        onChange={(event) => applyBase(event.target.value)}
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

            <div className="settingsActions">
                <button className="btn btnPrimary" type="button" onClick={save} disabled={busy}>
                    {busy ? "Сохраняем…" : enabled ? "Сохранить" : "Применить и сохранить"}
                </button>
                <button className="btn btnGhost" type="button" onClick={submitToCatalog} disabled={busy}>
                    Отправить на модерацию
                </button>
                <button className="btn btnGhost" type="button" onClick={clear} disabled={busy}>
                    Сбросить
                </button>
            </div>
        </section>
    );
};

export default LocalThemeSettings;
