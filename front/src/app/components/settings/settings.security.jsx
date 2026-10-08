import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../api/auth.service";
import userService from "../../api/user.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import "../../css/settings/settings.scss";

const SecuritySettingsPanel = () => {
    const navigate = useNavigate();
    const { logout, user, refreshUser } = useAuth();

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const [twoFactorOpen, setTwoFactorOpen] = useState(false);
    const [twoFactorPassword, setTwoFactorPassword] = useState("");

    const handlePassword = async (event) => {
        event.preventDefault();
        setSaving(true);
        setNotice(null);
        try {
            await userService.changePassword({
                current_password: current,
                new_password: next,
                confirm_password: confirm,
            });
            setCurrent("");
            setNext("");
            setConfirm("");
            setNotice({ kind: "success", text: "Пароль изменён. Прочие сессии завершены." });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSaving(false);
        }
    };

    const handleResendVerification = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const data = await authService.requestEmailVerification(user.email);
            setNotice({ kind: "success", text: data.message || "Письмо отправлено" });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSaving(false);
        }
    };

    const handleTwoFactor = async (event) => {
        event.preventDefault();
        setSaving(true);
        setNotice(null);

        try {
            const data = await userService.setTwoFactor(!user?.two_factor_email, twoFactorPassword);
            setNotice({ kind: "success", text: data.message || "Настройка сохранена" });
            setTwoFactorOpen(false);
            setTwoFactorPassword("");
            await refreshUser();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoutAll = async () => {
        setSaving(true);
        setNotice(null);
        try {
            await userService.logoutAll();
        } catch {
        } finally {
            await logout();
            navigate("/signin", { replace: true });
        }
    };

    return (
        <section className="settingsPanel">
            <header className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Безопасность</h2>
                <p className="mutedText">Пароль, активные сессии и защита аккаунта.</p>
            </header>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Почта</h3>
                <div className="settingsRow">
                    <div className="settingsRowMain">
                        <span className="settingsRowTitle">
                            {user?.email}
                            <span className="settingsBadge">
                                {user?.email_verified ? "подтверждена" : "не подтверждена"}
                            </span>
                        </span>
                        <span className="mutedText">
                            {user?.email_verified
                                ? "Адрес подтверждён: на него придут письма восстановления пароля."
                                : "Подтвердите адрес: на него придут письма восстановления пароля."}
                        </span>
                    </div>
                    {!user?.email_verified && (
                        <button
                            className="btn btnSmall"
                            type="button"
                            onClick={handleResendVerification}
                            disabled={saving}
                        >
                            Отправить письмо
                        </button>
                    )}
                </div>
            </div>

            <form className="card settingsForm" onSubmit={handlePassword}>
                <h3 className="settingsSectionLabel">Смена пароля</h3>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Текущий пароль</span>
                    <input
                        className="input"
                        type="password"
                        value={current}
                        onChange={(event) => setCurrent(event.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </label>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Новый пароль</span>
                    <input
                        className="input"
                        type="password"
                        value={next}
                        onChange={(event) => setNext(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                    <span className="fieldHint">Минимум 8 символов.</span>
                </label>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Повторите новый пароль</span>
                    <input
                        className="input"
                        type="password"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        autoComplete="new-password"
                        required
                    />
                </label>
                <div className="settingsActions">
                    <button className="btn btnPrimary" type="submit" disabled={saving}>
                        {saving ? "Сохраняем…" : "Сменить пароль"}
                    </button>
                </div>
            </form>

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Сессии</h3>
                <div className="settingsRow">
                    <div className="settingsRowMain">
                        <span className="settingsRowTitle">Выйти на всех устройствах</span>
                        <span className="mutedText">
                            Завершает все активные сессии, включая текущую — придётся войти заново.
                        </span>
                    </div>
                    <button
                        className="btn btnDanger btnSmall"
                        type="button"
                        onClick={handleLogoutAll}
                        disabled={saving}
                    >
                        Выйти везде
                    </button>
                </div>
            </div>

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Вход по коду из письма</h3>
                <div className="settingsRow">
                    <div className="settingsRowMain">
                        <span className="settingsRowTitle">
                            Вход в два шага
                            {user?.two_factor_email && (
                                <span className="settingsBadge">включён</span>
                            )}
                        </span>
                        <span className="mutedText">
                            После пароля понадобится код из письма. Опция выключена по умолчанию.
                        </span>
                    </div>
                    <button
                        className="btn btnSmall"
                        type="button"
                        onClick={() => {
                            setTwoFactorPassword("");
                            setTwoFactorOpen((previous) => !previous);
                        }}
                        disabled={saving}
                    >
                        {user?.two_factor_email ? "Выключить" : "Включить"}
                    </button>
                </div>

                {twoFactorOpen && (
                    <form className="settingsField" onSubmit={handleTwoFactor}>
                        <span className="settingsFieldLabel">Подтвердите пароль</span>
                        <input
                            className="input"
                            type="password"
                            value={twoFactorPassword}
                            onChange={(event) => setTwoFactorPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                        />
                        <div className="settingsActions">
                            <button
                                className="btn btnPrimary btnSmall"
                                type="submit"
                                disabled={saving}
                            >
                                {user?.two_factor_email ? "Выключить" : "Включить"}
                            </button>
                            <button
                                className="btn btnGhost btnSmall"
                                type="button"
                                onClick={() => setTwoFactorOpen(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </section>
    );
};

export default SecuritySettingsPanel;
