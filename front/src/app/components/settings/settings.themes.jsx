import React, { useCallback, useEffect, useMemo, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import useAppTheme from "../../hooks/use.app.theme";
import { Skeleton } from "../common/skeleton.jsx";
import { APP_THEMES, DEFAULT_THEME, themeByKey } from "../../themes/app.themes";
import {
    CUSTOM_THEME_PREFIX,
    THEME_VARIABLE_GROUPS,
    THEME_VARIABLE_NAMES,
    isHexColor,
    themeVariableLabel,
    validThemeColor,
} from "../../themes/theme.packages";

const SWATCH_PREVIEW = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const STATUS_LABELS = {
    draft: "черновик",
    pending: "на модерации",
    approved: "опубликована",
    rejected: "отклонена",
};

const STATUS_CLASSES = {
    draft: "tokenBadge",
    pending: "tokenBadge tokenBadgePending",
    approved: "tokenBadge tokenBadgeApproved",
    rejected: "tokenBadge tokenBadgeRejected",
};

const emptyForm = () => ({
    id: 0,
    title: "",
    description: "",
    mode: "dark",
    base: DEFAULT_THEME,
    overrides: {},
});

const baseThemeOf = (key) => APP_THEMES.find((item) => item.key === key) ?? APP_THEMES[0];

const ThemesSettings = ({ onApplied }) => {
    const { theme } = useAppTheme();

    const [themes, setThemes] = useState([]);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await themeService.own();
            setThemes(data?.themes ?? []);
            setLimit(data?.limit ?? 10);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const preview = useMemo(() => {
        if (!form) {
            return null;
        }
        return { ...baseThemeOf(form.base).variables, ...form.overrides };
    }, [form]);

    const validation = useMemo(() => {
        if (!form) {
            return "";
        }
        if (form.title.trim().length < 3) {
            return "Название темы: минимум 3 символа";
        }

        const names = Object.keys(form.overrides);
        if (names.length === 0) {
            return "Отметьте хотя бы одну переменную — остальное возьмётся из базовой темы";
        }

        for (const name of names) {
            if (!validThemeColor(form.overrides[name])) {
                return `${themeVariableLabel(name)}: нужен цвет вида #rrggbb или rgba(r, g, b, a)`;
            }
        }

        return "";
    }, [form]);

    const toggleVariable = (name) => {
        setForm((current) => {
            const overrides = { ...current.overrides };
            if (name in overrides) {
                delete overrides[name];
                return { ...current, overrides };
            }

            const source =
                themeByKey(theme).variables[name] ??
                baseThemeOf(current.base).variables[name] ??
                "#ffffff";
            overrides[name] = source;
            return { ...current, overrides };
        });
    };

    const setVariableValue = (name, value) => {
        setForm((current) => ({ ...current, overrides: { ...current.overrides, [name]: value } }));
    };

    const fillVariables = (source) => {
        setForm((current) => {
            const overrides = {};
            THEME_VARIABLE_NAMES.forEach((name) => {
                if (source[name]) {
                    overrides[name] = source[name];
                }
            });
            return { ...current, overrides };
        });
    };

    const save = async (event) => {
        event.preventDefault();
        setNotice(null);

        if (validation) {
            setNotice({ kind: "error", text: validation });
            return;
        }

        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            mode: form.mode,
            base: form.base,
            variables: form.overrides,
        };

        setBusy(true);
        try {
            const data = form.id
                ? await themeService.update(form.id, payload)
                : await themeService.create(payload);

            setForm((current) => ({ ...current, id: data?.theme?.id ?? current.id }));
            setNotice({ kind: "success", text: data?.message || "Тема сохранена" });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    const submitForModeration = async (id) => {
        setNotice(null);
        try {
            const data = await themeService.submit(id);
            setNotice({ kind: "success", text: data?.message || "Тема отправлена на модерацию" });
            setForm(null);
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    const removeTheme = async (id) => {
        setNotice(null);
        try {
            await themeService.remove(id);
            setConfirming(0);
            setForm((current) => (current?.id === id ? null : current));
            setNotice({ kind: "success", text: "Тема удалена" });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    const withdrawTheme = async (id) => {
        setNotice(null);

        try {
            const data = await themeService.withdraw(id);
            setForm((current) => (current?.id === id ? null : current));
            setNotice({ kind: "success", text: data?.message || "Тема снята с публикации" });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    const startCreate = () => {
        setNotice(null);
        setForm(emptyForm());
    };

    const startEdit = (item) =>
        setForm({
            id: item.id,
            key: item.key,
            title: item.title,
            description: item.description,
            mode: item.mode,
            base: item.base,
            overrides: { ...item.variables },
        });

    return (
        <div className="card settingsForm">
            <h3 className="settingsSectionLabel">Свои темы</h3>
            <p className="mutedText">
                Тема — это набор цветов поверх одной из встроенных. Соберите свою, отправьте на
                модерацию, и после одобрения она появится в списке тем у всех пользователей.
            </p>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            {loading ? (
                <Skeleton variant="row" count={2} label="Загружаем свои темы…" />
            ) : themes.length === 0 ? (
                <p className="mutedText">Своих тем пока нет.</p>
            ) : (
                <ul className="tokenList">
                    {themes.map((item) => (
                        <li className="tokenRow" key={item.id}>
                            <div className="tokenRowMain">
                                <span className="tokenTitle">
                                    {item.title}
                                    <span className={STATUS_CLASSES[item.status] ?? "tokenBadge"}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </span>
                                    {item.pending && (
                                        <span className="tokenBadge">правка на модерации</span>
                                    )}
                                </span>
                                <span className="tokenMeta">
                                    <code>{item.key}</code> · база: {baseThemeOf(item.base).label} ·{" "}
                                    {item.mode === "light" ? "светлый режим" : "тёмный режим"} ·
                                    переменных: {Object.keys(item.variables).length}
                                </span>
                                {item.moderation_note && (
                                    <span className="themeNote">
                                        {item.status === "rejected"
                                            ? "Причина отказа: "
                                            : "Замечание модератора: "}
                                        {item.moderation_note}
                                    </span>
                                )}
                            </div>

                            <div className="tokenRowActions">
                                {item.status === "approved" && (
                                    <>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() =>
                                                onApplied(`${CUSTOM_THEME_PREFIX}${item.key}`)
                                            }
                                        >
                                            Применить
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => startEdit(item)}
                                        >
                                            Изменить
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => withdrawTheme(item.id)}
                                            disabled={Boolean(item.pending)}
                                            title="Тема исчезнет из каталога, правки снова станут доступны сразу"
                                        >
                                            {item.pending ? "Ждёт модерации" : "Снять с публикации"}
                                        </button>
                                    </>
                                )}
                                {(item.status === "draft" || item.status === "rejected") && (
                                    <>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => startEdit(item)}
                                        >
                                            Изменить
                                        </button>
                                        <button
                                            className="btn btnPrimary btnSmall"
                                            type="button"
                                            onClick={() => submitForModeration(item.id)}
                                        >
                                            На модерацию
                                        </button>
                                    </>
                                )}
                                {confirming === item.id ? (
                                    <>
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            onClick={() => removeTheme(item.id)}
                                        >
                                            Удалить
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => setConfirming(0)}
                                        >
                                            Отмена
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        onClick={() => setConfirming(item.id)}
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {!form && (
                <div className="settingsActions">
                    <button
                        className="btn btnPrimary"
                        type="button"
                        onClick={startCreate}
                        disabled={themes.length >= limit}
                    >
                        Создать тему
                    </button>
                    <span className="mutedText">
                        Использовано {themes.length} из {limit}.
                    </span>
                </div>
            )}

            {form && (
                <form className="themeForm" onSubmit={save}>
                    <div className="themeGrid">
                        <label className="settingsField">
                            <span className="settingsFieldLabel">Название</span>
                            <input
                                className="input"
                                value={form.title}
                                onChange={(event) => setForm({ ...form, title: event.target.value })}
                                maxLength={60}
                                placeholder="Северные сумерки"
                                required
                            />
                            <span className="fieldHint">
                                Ключ темы соберётся из названия сам — придумывать его не нужно.
                            </span>
                        </label>
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
                            <span className="settingsFieldLabel">Режим</span>
                            <select
                                className="input"
                                value={form.mode}
                                onChange={(event) => setForm({ ...form, mode: event.target.value })}
                            >
                                <option value="dark">Тёмный</option>
                                <option value="light">Светлый</option>
                            </select>
                        </label>
                    </div>

                    <label className="settingsField">
                        <span className="settingsFieldLabel">Описание</span>
                        <input
                            className="input"
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            maxLength={200}
                            placeholder="Чем тема отличается от базовой"
                        />
                    </label>

                    <div className="themePreview">
                        {SWATCH_PREVIEW.map((name) => (
                            <span
                                key={name}
                                className="themePreviewSwatch"
                                style={{ backgroundColor: preview?.[name] }}
                            />
                        ))}
                        <span className="mutedText">
                            Предпросмотр · переменных: {Object.keys(form.overrides).length}
                        </span>
                    </div>

                    <div className="settingsActions">
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => fillVariables(baseThemeOf(form.base).variables)}
                        >
                            Взять из базы
                        </button>
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => fillVariables(themeByKey(theme).variables)}
                        >
                            Взять из текущей темы
                        </button>
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => fillVariables({})}
                        >
                            Снять все
                        </button>
                    </div>

                    <div className="themeVariableList">
                        {THEME_VARIABLE_GROUPS.map((group) => (
                            <div className="themeVariableGroup" key={group.key}>
                                <span className="themeVariableGroupTitle">{group.title}</span>
                                {group.variables.map((item) => {
                                    const included = item.name in form.overrides;
                                    const value = included
                                        ? form.overrides[item.name]
                                        : baseThemeOf(form.base).variables[item.name] ?? "";

                                    return (
                                        <div className="themeVariableRow" key={item.name}>
                                            <label className="themeVariableCheck">
                                                <input
                                                    type="checkbox"
                                                    checked={included}
                                                    onChange={() => toggleVariable(item.name)}
                                                />
                                                <span>{item.label}</span>
                                            </label>
                                            <input
                                                type="color"
                                                className="themeVariableColor"
                                                value={isHexColor(value) ? value : "#000000"}
                                                onChange={(event) =>
                                                    setVariableValue(item.name, event.target.value)
                                                }
                                                disabled={!included}
                                                aria-label={`${item.label}: цвет`}
                                            />
                                            <input
                                                className="input themeVariableValue"
                                                value={included ? form.overrides[item.name] : ""}
                                                placeholder={value}
                                                onChange={(event) =>
                                                    setVariableValue(item.name, event.target.value)
                                                }
                                                disabled={!included}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {validation && <p className="fieldHint">{validation}</p>}

                    <div className="settingsActions">
                        <button
                            className="btn btnPrimary"
                            type="submit"
                            disabled={busy || Boolean(validation)}
                        >
                            {busy ? "Сохраняем…" : form.id ? "Сохранить" : "Создать черновик"}
                        </button>
                        {form.id > 0 && (
                            <button
                                className="btn btnGhost"
                                type="button"
                                onClick={() => submitForModeration(form.id)}
                            >
                                На модерацию
                            </button>
                        )}
                        <button className="btn btnGhost" type="button" onClick={() => setForm(null)}>
                            Отмена
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default ThemesSettings;
