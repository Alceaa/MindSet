import React, { useCallback, useEffect, useState } from "react";
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";

const ACTION_LABELS = {
    block_user: "блокировка",
    unblock_user: "разблокировка",
    set_role: "смена роли",
    delete_set: "удаление сета",
    create_news: "новость создана",
    update_news: "новость изменена",
    delete_news: "новость удалена",
    report_status: "статус репорта",
};

const AdminJournalPanel = () => {
    const [actions, setActions] = useState([]);
    const [notice, setNotice] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await adminService.listActions({ limit: 100 });
            setActions(data.actions || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Журнал действий</h2>
            </header>

            {notice && (
                <div className="alert alertError" role="status">
                    {notice.text}
                </div>
            )}

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>Когда</th>
                            <th>Админ</th>
                            <th>Действие</th>
                            <th>Объект</th>
                            <th>Детали</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map((item) => (
                            <tr key={item.id}>
                                <td className="adminTableCellMuted">{item.created_at}</td>
                                <td className="adminTableCellMuted">{item.admin_login || "—"}</td>
                                <td>{ACTION_LABELS[item.action] || item.action}</td>
                                <td className="adminTableCellMuted">
                                    {item.target_type} #{item.target_id}
                                </td>
                                <td className="adminTableCellMuted">{item.details || "—"}</td>
                            </tr>
                        ))}
                        {!actions.length && (
                            <tr>
                                <td colSpan={5} className="adminEmpty">
                                    Журнал пуст
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminJournalPanel;
