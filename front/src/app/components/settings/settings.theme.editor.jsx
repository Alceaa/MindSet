import React, { useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import { APP_THEMES, DEFAULT_THEME } from "../../themes/app.themes";
import { THEME_PRESETS, rolesFromVariables } from "../../themes/theme.roles";
import { themeFileText, themeFileName } from "../../themes/theme.transfer";
import ThemeRolesFields from "./theme.roles.fields.jsx";
import "../../css/settings/settings.scss";

const TITLE_MIN = 3;
const DESCRIPTION_MAX = 200;

const emptyTheme = () => ({
    title: "",
    description: "",
    mode: THEME_PRESETS[0].mode,
    base: THEME_PRESETS[0].base,
    roles: { ...THEME_PRESETS[0].roles },
});

/**
 * Конструктор темы: восемь ролей, базовая тема и режим. Форма одна — и на новую тему, и на
 * правку сохранённой: что выбрано в «Моих темах», то и редактируем. Импортированная тема
 * приходит сюда черновиком: сначала посмотреть, потом сохранять.
 */
const ThemeEditor = ({ item, draft, count, limit, onSaved, onDeleted }) => {
    const [form, setForm] = useState(emptyTheme);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [confirming, setConfirming] = useState(false);

    // Заполняем форму: сохранённая тема, импортированный черновик или пустая новая.
    useEffect(() => {
        setNotice(null);
        setConfirming(false);

        if (draft) {
            setForm({
                ...emptyTheme(),
                ...draft,
                roles: { ...emptyTheme().roles, ...(draft.roles ?? {}) },
            });
            return;
        }

        if (item) {
            setForm({
                title: item.title ?? "",
                description: item.description ?? "",
                mode: item.mode === "light" ? "light" : "dark",
                base: item.base || DEFAULT_THEME,
                roles: { ...emptyTheme().roles, ...(item.roles ?? {}) },
            });
            return;
        }

        setForm(emptyTheme());
    }, [item, draft]);

    const setRole = (key, value) =>
        setForm((current) => ({ ...current, roles: { ...current.roles, [key]: value } }));

    // Базовая тема — стартовая точка: её цвета и режим подставляем в форму, дальше их правят.
    const applyBase = (key) => {
        const baseTheme = APP_THEMES.find((theme) => theme.key === key) ?? APP_THEMES[0];

        setForm((current) => ({
            ...current,
            base: baseTheme.key,
            mode: baseTheme.mode === "light" ? "light" : "dark",
            roles: rolesFromVariables(baseTheme.variables),
        }));
    };

    const applyPreset = (preset) =>
        setForm((current) => ({
            ...current,
            mode: preset.mode,
            base: preset.base,
            roles: { ...preset.roles },
        }));

    const titleReady = form.title.trim().length >= TITLE_MIN;
    const atLimit = !item && count >= limit;

    const payload = () => ({
        title: form.title.trim(),
        description: form.description.trim(),
        mode: form.mode,
        base: form.base,
        roles: form.roles,
    });

    // Сохраняем в библиотеку. asNew — «сохранить как новую»: так из одной темы делают вариант.
    const save = async (asNew) => {
        if (!titleReady) {
            setNotice({ kind: "error", text: `Название темы: минимум ${TITLE_MIN} символа` });
            return;
        }

        setBusy(true);
        setNotice(null);

        try {
            const data =
                asNew || !item
                    ? await themeService.create(payload())
                    : await themeService.update(item.id, payload());

            setNotice({ kind: "success", text: data?.message || "Тема сохранена" });
            onSaved(data?.theme ?? null);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        setNotice(null);

        try {
            const data = await themeService.remove(item.id);
            setNotice({ kind: "success", text: data?.message || "Тема удалена" });
            onDeleted(item.id);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
            setConfirming(false);
        }
    };

    // Обмен без сервера: тема уезжает файлом или текстом, импорт — в списке «Мои темы».
    const download = () => {
        const blob = new Blob([themeFileText(form)], { type: "application/json" });
        const link = document.createElement("a");
        const href = URL.createObjectURL(blob);

        link.href = href;
        link.download = themeFileName(form.title, item?.key);
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);

        setNotice({ kind: "success", text: "Файл темы сохранён" });
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(themeFileText(form));
            setNotice({ kind: "success", text: "Тема скопирована — можно переслать текстом" });
        } catch {
            setNotice({
                kind: "error",
                text: "Браузер не дал доступ к буферу обмена — скачайте файлом",
            });
        }
    };

    return (
        <section className="card settingsForm" id="themeConstructor">
            <span className="settingsSectionLabel">
                {item ? `Правка темы «${item.title}»` : "Конструктор темы"}
            </span>
            <p className="mutedText">
                Соберите оформление из восьми цветов: остальное подберётся само. Тем можно
                сохранить до {limit} и переключаться между ними.
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
                <span className="settingsFieldLabel">Название</span>
                <input
                    className="input"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    maxLength={60}
                    placeholder="Морская ночь"
                />
                {!titleReady && (
                    <span className="settingsFieldHint">
                        Минимум {TITLE_MIN} символа
                    </span>
                )}
            </label>

            <label className="settingsField">
                <span className="settingsFieldLabel">Описание (необязательно)</span>
                <input
                    className="input"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="Пара слов для списка тем"
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
                        {APP_THEMES.map((theme) => (
                            <option key={theme.key} value={theme.key}>
                                {theme.label}
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
                <button
                    className="btn btnPrimary"
                    type="button"
                    disabled={busy || !titleReady}
                    onClick={() => save(false)}
                >
                    {busy ? "Сохраняем…" : item ? "Сохранить" : "Сохранить в библиотеку"}
                </button>
                <button
                    className="btn btnGhost"
                    type="button"
                    disabled={busy || !titleReady || atLimit}
                    onClick={() => save(true)}
                >
                    Сохранить как новую
                </button>
                <button className="btn btnGhost" type="button" onClick={download}>
                    Скачать файлом
                </button>
                <button className="btn btnGhost" type="button" onClick={copy}>
                    Скопировать
                </button>
                {item &&
                    (confirming ? (
                        <>
                            <button
                                className="btn btnDanger"
                                type="button"
                                disabled={busy}
                                onClick={remove}
                            >
                                Удалить тему
                            </button>
                            <button
                                className="btn btnGhost"
                                type="button"
                                onClick={() => setConfirming(false)}
                            >
                                Отмена
                            </button>
                        </>
                    ) : (
                        <button
                            className="btn btnGhost"
                            type="button"
                            onClick={() => setConfirming(true)}
                        >
                            Удалить
                        </button>
                    ))}
            </div>

            {atLimit && (
                <span className="settingsFieldHint">
                    В библиотеке уже {limit} тем — удалите ненужную, чтобы сохранить ещё одну
                </span>
            )}
        </section>
    );
};

export default ThemeEditor;
