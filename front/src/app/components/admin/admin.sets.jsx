import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";

const AdminSetsPanel = () => {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [sets, setSets] = useState([]);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState(null);
    const [target, setTarget] = useState(null);
    const [forbidCopies, setForbidCopies] = useState(false);

    const load = useCallback(async () => {
        setPending(true);
        try {
            const data = await adminService.listSets({ q: query, limit: 50 });
            setSets(data.sets || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setPending(false);
        }
    }, [query]);

    useEffect(() => {
        load();
    }, [load]);

    const remove = async () => {
        setNotice(null);
        try {
            const data = await adminService.deleteSet(target.id, forbidCopies);
            setNotice({ kind: "success", text: data.message });
            setTarget(null);
            setForbidCopies(false);
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Сеты</h2>
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
                        placeholder="Название или автор"
                    />
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
                        Удаление сета <strong>{target.title}</strong> (автор {target.author_login || "—"})
                    </span>
                    <label className="mutedText">
                        <input
                            type="checkbox"
                            checked={forbidCopies}
                            onChange={(event) => setForbidCopies(event.target.checked)}
                        />{" "}
                        очистить и копии (иначе копии останутся снимками на 30 дней)
                    </label>
                    <div className="settingsActions">
                        <button className="btn btnDanger btnSmall" type="button" onClick={remove}>
                            Удалить сет
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
                            <th>Название</th>
                            <th>Автор</th>
                            <th>Видимость</th>
                            <th>Символов</th>
                            <th>Активность</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sets.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <Link className="link" to={`/s/${item.slug}`}>
                                        {item.title}
                                    </Link>
                                    {item.forbid_copies && <span className="adminBadge">копии закрыты</span>}
                                </td>
                                <td className="adminTableCellMuted">{item.author_login || "—"}</td>
                                <td className="adminTableCellMuted">{item.visibility}</td>
                                <td className="adminTableCellMuted">{item.content_length}</td>
                                <td className="adminTableCellMuted">{item.last_activity || "—"}</td>
                                <td>
                                    <button
                                        className="btn btnDanger btnSmall"
                                        type="button"
                                        onClick={() => {
                                            setTarget(item);
                                            setForbidCopies(false);
                                        }}
                                    >
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!sets.length && !pending && (
                            <tr>
                                <td colSpan={6} className="adminEmpty">
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

export default AdminSetsPanel;
