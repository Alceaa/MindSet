import React, { useCallback, useEffect, useState } from "react";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";

const AdminInvitesPanel = () => {
    const [items, setItems] = useState([]);
    const [note, setNote] = useState("");
    const [days, setDays] = useState(7);
    const [link, setLink] = useState("");
    const [notice, setNotice] = useState(null);
    const [pending, setPending] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await adminService.listInvites({ limit: 50 });
            setItems(data.invites || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const create = async (event) => {
        event.preventDefault();
        setPending(true);
        setNotice(null);

        try {
            const data = await adminService.createInvite({ note: note.trim(), days: Number(days) });
            setLink(data.url);
            setNote("");
            setNotice({ kind: "success", text: "Приглашение создано — отправьте ссылку человеку" });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setPending(false);
        }
    };

    const revoke = async (item) => {
        if (!window.confirm(`Отозвать приглашение #${item.id}?`)) {
            return;
        }
        setNotice(null);
        try {
            const data = await adminService.revokeInvite(item.id);
            setNotice({ kind: "success", text: data.message });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setNotice({ kind: "success", text: "Ссылка скопирована" });
        } catch (err) {
            setNotice({ kind: "error", text: "Скопируйте ссылку вручную" });
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Приглашения</h2>
            </header>

            {notice && (
                <div className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`} role="status">
                    {notice.text}
                </div>
            )}

            <form className="adminEditor" onSubmit={create}>
                <span className="settingsFieldLabel">Новое приглашение</span>
                <input
                    className="input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Для кого (заметка для себя)"
                    maxLength={200}
                />
                <label className="mutedText">
                    Действует дней:{" "}
                    <input
                        className="input"
                        style={{ width: 80, display: "inline-block" }}
                        type="number"
                        min={1}
                        max={90}
                        value={days}
                        onChange={(event) => setDays(event.target.value)}
                    />
                </label>
                <div className="settingsActions">
                    <button className="btn btnPrimary btnSmall" type="submit" disabled={pending}>
                        Создать ссылку
                    </button>
                </div>
            </form>

            {link && (
                <div className="adminEditor">
                    <span className="settingsFieldLabel">Ссылка-приглашение</span>
                    <div className="visibilitySlug">{link}</div>
                    <div className="settingsActions">
                        <button className="btn btnSmall" type="button" onClick={copy}>
                            Скопировать
                        </button>
                    </div>
                </div>
            )}

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Заметка</th>
                            <th>Создано</th>
                            <th>Истекает</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td className="adminTableCellMuted">{item.id}</td>
                                <td>{item.note || "—"}</td>
                                <td className="adminTableCellMuted">{item.created_at}</td>
                                <td className="adminTableCellMuted">{item.expires_at}</td>
                                <td>
                                    {item.used ? (
                                        <span className="adminBadge">использовано {item.used_at}</span>
                                    ) : (
                                        <span className="adminBadge adminBadgeSuccess">активно</span>
                                    )}
                                </td>
                                <td>
                                    {!item.used && (
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            onClick={() => revoke(item)}
                                        >
                                            Отозвать
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr>
                                <td colSpan={6} className="adminEmpty">
                                    Приглашений ещё не было
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminInvitesPanel;
