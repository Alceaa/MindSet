import React, { useCallback, useEffect, useState } from "react";
import notificationsService from "../../api/notifications.service";
import parseApiError from "../../utils/api.error";

const NotificationsSettingsPanel = () => {
    const [kinds, setKinds] = useState([]);
    const [prefs, setPrefs] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");

        notificationsService
            .getPrefs()
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setKinds(data.kinds ?? []);
                setPrefs(data.prefs ?? {});
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(parseApiError(err).message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = useCallback(async (kind, enabled) => {
        setSaving(kind);
        setError("");

        try {
            const data = await notificationsService.setPref(kind, enabled);
            setPrefs(data.prefs ?? {});
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setSaving("");
        }
    }, []);

    return (
        <div className="settingsPanel">
            <div className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Уведомления</h2>
                <p className="mutedText">
                    Что показывать в колокольчике в шапке. Отключённые события не создаются вовсе,
                    включить обратно можно в любой момент.
                </p>
            </div>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Категории</h3>
                {loading && <p className="mutedText">Загружаем настройки…</p>}
                {!loading &&
                    kinds.map((item) => (
                        <div className="settingsRow" key={item.kind}>
                            <div className="settingsRowMain">
                                <span className="settingsRowTitle">
                                    {item.label}
                                    {!prefs[item.kind] && (
                                        <span className="settingsBadge">выключено</span>
                                    )}
                                </span>
                                <span className="mutedText">{item.hint}</span>
                            </div>
                            <button
                                className="btn btnSmall"
                                type="button"
                                onClick={() => toggle(item.kind, !prefs[item.kind])}
                                disabled={saving === item.kind}
                            >
                                {prefs[item.kind] ? "Выключить" : "Включить"}
                            </button>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default NotificationsSettingsPanel;
