import React, { useCallback, useEffect, useState } from "react";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";

const FILTERS = [
    { value: "", label: "Все" },
    { value: "new", label: "Новые" },
    { value: "in_progress", label: "В работе" },
    { value: "done", label: "Закрытые" },
    { value: "rejected", label: "Отклонённые" },
];

const STATUS_LABELS = {
    new: "новый",
    in_progress: "в работе",
    done: "закрыт",
    rejected: "отклонён",
};

const AdminReportsPanel = () => {
    const [status, setStatus] = useState("");
    const [reports, setReports] = useState([]);
    const [notice, setNotice] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await adminService.listReports({ status: status, limit: 50 });
            setReports(data.reports || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    }, [status]);

    useEffect(() => {
        load();
    }, [load]);

    const changeStatus = async (item, next) => {
        setNotice(null);
        try {
            await adminService.setReportStatus(item.id, next);
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Репорты</h2>
                <div className="adminToolbar">
                    <select
                        className="input"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        style={{ flex: "0 1 200px" }}
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
                <div className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`} role="status">
                    {notice.text}
                </div>
            )}

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Автор</th>
                            <th>Страница</th>
                            <th>Тема и текст</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((item) => (
                            <tr key={item.id}>
                                <td className="adminTableCellMuted">{item.created_at}</td>
                                <td className="adminTableCellMuted">{item.login || "аноним"}</td>
                                <td className="adminTableCellMuted">{item.page || "—"}</td>
                                <td>
                                    <strong>{item.topic}</strong>
                                    <div className="adminBody">{item.message}</div>
                                </td>
                                <td>
                                    <span className="adminBadge">{STATUS_LABELS[item.status] || item.status}</span>
                                </td>
                                <td>
                                    <div className="adminRowActions">
                                        {item.status !== "in_progress" && item.status !== "done" && (
                                            <button
                                                className="btn btnSmall"
                                                type="button"
                                                onClick={() => changeStatus(item, "in_progress")}
                                            >
                                                В работу
                                            </button>
                                        )}
                                        {item.status !== "done" && (
                                            <button
                                                className="btn btnSmall"
                                                type="button"
                                                onClick={() => changeStatus(item, "done")}
                                            >
                                                Закрыть
                                            </button>
                                        )}
                                        {item.status !== "rejected" && (
                                            <button
                                                className="btn btnGhost btnSmall"
                                                type="button"
                                                onClick={() => changeStatus(item, "rejected")}
                                            >
                                                Отклонить
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!reports.length && (
                            <tr>
                                <td colSpan={6} className="adminEmpty">
                                    Репортов нет
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminReportsPanel;
