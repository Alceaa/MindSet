import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";

const AdminUsersPanel = () => {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [blockedOnly, setBlockedOnly] = useState(false);
    const [users, setUsers] = useState([]);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState(null);
    const [target, setTarget] = useState(null);
    const [reason, setReason] = useState("");

    const load = useCallback(async () => {
        setPending(true);
        try {
            const data = await adminService.listUsers({ q: query, blocked: blockedOnly, limit: 50 });
            setUsers(data.users || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setPending(false);
        }
    }, [query, blockedOnly]);

    useEffect(() => {
        load();
    }, [load]);

    const run = async (action) => {
        setNotice(null);
        try {
            const data = await action();
            setNotice({ kind: "success", text: data.message || "Готово" });
            setTarget(null);
            setReason("");
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Пользователи</h2>
                <form
                    className="adminToolbar"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setQuery(search.trim());
                    }}
                >
                    <input
                        className="input"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Логин или почта"
                    />
                    <label className="mutedText">
                        <input
                            type="checkbox"
                            checked={blockedOnly}
                            onChange={(event) => setBlockedOnly(event.target.checked)}
                        />{" "}
                        только заблокированные
                    </label>
                    <button className="btn btnPrimary btnSmall" type="submit" disabled={pending}>
                        Найти
                    </button>
                </form>
            </header>

            {notice && (
                <div className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`} role="status">
                    {notice.text}
                </div>
            )}

            {target && (
                <div className="adminEditor">
                    <span className="settingsFieldLabel">
                        Блокировка пользователя <strong>{target.login}</strong>
                    </span>
                    <input
                        className="input"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Причина (увидит пользователь при входе)"
                        maxLength={300}
                    />
                    <div className="settingsActions">
                        <button
                            className="btn btnDanger btnSmall"
                            type="button"
                            onClick={() => run(() => adminService.blockUser(target.id, reason))}
                        >
                            Заблокировать
                        </button>
                        <button className="btn btnGhost btnSmall" type="button" onClick={() => setTarget(null)}>
                            Отмена
                        </button>
                    </div>
                </div>
            )}

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>Логин</th>
                            <th>Почта</th>
                            <th>Роль</th>
                            <th>Сеты</th>
                            <th>Активность</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <Link className="link" to={`/u/${user.login}`}>
                                        {user.login}
                                    </Link>
                                    {user.two_factor_email && <span className="adminBadge">2FA</span>}
                                </td>
                                <td className="adminTableCellMuted">{user.email}</td>
                                <td>{user.role === "admin" ? "админ" : "—"}</td>
                                <td className="adminTableCellMuted">{user.set_count}</td>
                                <td className="adminTableCellMuted">{user.last_activity || "—"}</td>
                                <td>
                                    {user.blocked ? (
                                        <span className="adminBadge adminBadgeDanger">заблокирован</span>
                                    ) : (
                                        <span className="adminBadge adminBadgeSuccess">активен</span>
                                    )}
                                    {user.blocked && user.blocked_reason && (
                                        <div className="adminTableCellMuted">{user.blocked_reason}</div>
                                    )}
                                </td>
                                <td>
                                    <div className="adminRowActions">
                                        {user.blocked ? (
                                            <button
                                                className="btn btnSmall"
                                                type="button"
                                                onClick={() => run(() => adminService.unblockUser(user.id))}
                                            >
                                                Разблокировать
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btnDanger btnSmall"
                                                type="button"
                                                onClick={() => {
                                                    setTarget(user);
                                                    setReason("");
                                                }}
                                            >
                                                Заблокировать
                                            </button>
                                        )}
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() =>
                                                run(() =>
                                                    adminService.setRole(
                                                        user.id,
                                                        user.role === "admin" ? "user" : "admin"
                                                    )
                                                )
                                            }
                                        >
                                            {user.role === "admin" ? "Снять админа" : "Сделать админом"}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!users.length && !pending && (
                            <tr>
                                <td colSpan={7} className="adminEmpty">
                                    Ничего не найдено
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminUsersPanel;
