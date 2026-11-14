import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/auth.context";
import NotFound from "../routing/not.found.jsx";
import AdminNewsPanel from "./admin.news.jsx";
import AdminUsersPanel from "./admin.users.jsx";
import AdminSetsPanel from "./admin.sets.jsx";
import AdminInvitesPanel from "./admin.invites.jsx";
import AdminReportsPanel from "./admin.reports.jsx";
import AdminJournalPanel from "./admin.journal.jsx";
import "../../css/admin/admin.scss";

const NAV = [
    { key: "news", label: "Новости" },
    { key: "users", label: "Пользователи" },
    { key: "sets", label: "Сеты" },
    { key: "invites", label: "Приглашения" },
    { key: "reports", label: "Репорты" },
    { key: "journal", label: "Журнал" },
];

const Admin = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const tab = searchParams.get("tab") || "news";

    if (!user || user.role !== "admin") {
        return <NotFound />;
    }

    const renderPanel = () => {
        switch (tab) {
            case "users":
                return <AdminUsersPanel />;
            case "sets":
                return <AdminSetsPanel />;
            case "invites":
                return <AdminInvitesPanel />;
            case "reports":
                return <AdminReportsPanel />;
            case "journal":
                return <AdminJournalPanel />;
            default:
                return <AdminNewsPanel />;
        }
    };

    return (
        <div className="page">
            <div className="adminLayout">
                <aside className="adminNav">
                    <h1 className="adminNavTitle">Админка</h1>
                    {NAV.map((item) => (
                        <Link
                            key={item.key}
                            className={`adminNavItem${tab === item.key ? " adminNavItemActive" : ""}`}
                            to={`/admin?tab=${item.key}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </aside>
                <section className="adminPanel">{renderPanel()}</section>
            </div>
        </div>
    );
};

export default Admin;
