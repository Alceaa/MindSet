import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProfileSettingsPanel from "./settings.profile.jsx";
import SecuritySettingsPanel from "./settings.security.jsx";
import BugReportPanel from "./settings.bug.jsx";
import "../../css/settings/settings.scss";

const NAV = [
    { key: "profile", label: "Настройки профиля" },
    { key: "security", label: "Безопасность" },
    { key: "bug", label: "Сообщить о проблеме" },
];

const Settings = () => {
    const [searchParams] = useSearchParams();
    const tab = searchParams.get("tab") || "profile";

    const renderPanel = () => {
        if (tab === "security") {
            return <SecuritySettingsPanel />;
        }
        if (tab === "bug") {
            return <BugReportPanel />;
        }
        return <ProfileSettingsPanel />;
    };

    return (
        <div className="page settingsPage">
            <div className="settingsLayout">
                <aside className="settingsNav">
                    <h1 className="settingsNavTitle">Настройки</h1>
                    {NAV.map((item) => (
                        <Link
                            key={item.key}
                            className={`settingsNavItem${
                                tab === item.key ? " settingsNavItemActive" : ""
                            }`}
                            to={item.key === "profile" ? "/settings" : `/settings?tab=${item.key}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </aside>
                <div className="settingsContent">{renderPanel()}</div>
            </div>
        </div>
    );
};

export default Settings;
