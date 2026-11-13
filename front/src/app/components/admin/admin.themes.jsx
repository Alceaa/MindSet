import React, { useCallback, useEffect, useState } from "react";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";
import { formatDateTime } from "../../utils/date.time";
import { customThemeFromPackage } from "../../themes/app.themes";
import { themeVariableLabel } from "../../themes/theme.packages";

const FILTERS = [
    { value: "pending", label: "На модерации" },
    { value: "approved", label: "Опубликованные" },
    { value: "rejected", label: "Отклонённые" },
    { value: "draft", label: "Черновики" },
    { value: "", label: "Все" },
];

const STATUS_LABELS = {
    draft: "черновик",
    pending: "на модерации",
    approved: "опубликована",
    rejected: "отклонена",
};

const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const AdminThemesPanel = () => {
    const [status, setStatus] = useState("pending");
    const [themes, setThemes] = useState([]);
    const [notes, setNotes] = useState({});
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(0);

    const load = useCallback(async () => {
        try {
            const data = await adminService.listThemes({ status, limit: 50 });
            setThemes(data?.themes ?? []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    }, [status]);

    useEffect(() => {
        load();
    }, [load]);

    const moderate = async (item, next) => {
        const note = (notes[item.id] ?? "").trim();

        if (next === "rejected" && !note) {
            setNotice({
                kind: "error",
                text: "Укажите причину отказа — её увидит автор темы",
            });
            return;
        }

        setBusy(item.id);
        setNotice(null);
        try {
            const data = await adminService.moderateTheme(item.id, next, note);
            setNotice({ kind: "success", text: data?.message || "Статус темы обновлён" });
            setNotes((current) => ({ ...current, [item.id]: "" }));
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(0);
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Темы</h2>
                <div className="adminToolbar">
                    <select
                        className="input"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        {FILTERS.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>Обновлена</th>
                            <th>Тема</th>
                            <th>Образцы</th>
                            <th>Переменные</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {themes.map((item) => {
                            const theme = customThemeFromPackage(item);

                            return (
                                <tr key={item.id}>
                                    <td className="adminTableCellMuted">
                                        {formatDateTime(item.updated_at)}
                                    </td>
                                    <td>
                                        <strong>{item.title}</strong>
                                        <div className="adminBody">
                                            <code>{item.key}</code> · автор: {item.author || "—"} ·
                                            база: {item.base} ·{" "}
                                            {item.mode === "light" ? "светлый" : "тёмный"} режим
                                        </div>
                                        {item.description && (
                                            <div className="adminBody">{item.description}</div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="adminSwatches" aria-hidden="true">
                                            {SWATCHES.map((name) => (
                                                <span
                                                    key={name}
                                                    className="adminSwatch"
                                                    style={{
                                                        backgroundColor: theme?.variables?.[name],
                                                    }}
                                                />
                                            ))}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="adminVariableList">
                                            {Object.entries(item.variables).map(([name, value]) => (
                                                <span className="adminVariable" key={name}>
                                                    <span
                                                        className="adminSwatchSmall"
                                                        style={{ backgroundColor: value }}
                                                    />
                                                    {themeVariableLabel(name)}
                                                    <code>{value}</code>
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="adminBadge">
                                            {STATUS_LABELS[item.status] ?? item.status}
                                        </span>
                                        {item.status === "rejected" && item.moderation_note && (
                                            <div className="adminBody">{item.moderation_note}</div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="adminRowActions adminRowActionsColumn">
                                            <input
                                                className="input adminNoteInput"
                                                value={notes[item.id] ?? ""}
                                                onChange={(event) =>
                                                    setNotes((current) => ({
                                                        ...current,
                                                        [item.id]: event.target.value,
                                                    }))
                                                }
                                                maxLength={300}
                                                placeholder="Причина отказа"
                                                aria-label="Причина отказа"
                                            />
                                            {item.status !== "approved" && (
                                                <button
                                                    className="btn btnSmall"
                                                    type="button"
                                                    disabled={busy === item.id}
                                                    onClick={() => moderate(item, "approved")}
                                                >
                                                    Опубликовать
                                                </button>
                                            )}
                                            {item.status !== "rejected" && (
                                                <button
                                                    className="btn btnGhost btnSmall"
                                                    type="button"
                                                    disabled={busy === item.id}
                                                    onClick={() => moderate(item, "rejected")}
                                                >
                                                    Отклонить
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {!themes.length && (
                            <tr>
                                <td colSpan={6} className="adminEmpty">
                                    Тем в этом статусе нет
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminThemesPanel;
