import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import authService from "../../api/auth.service";
import parseApiError from "../../utils/api.error";

const ResetPassword = () => {
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    if (!token) {
        return (
            <div className="formCard">
                <h1 className="formTitle">Сброс пароля</h1>
                <div className="alert alertError" role="alert">
                    В ссылке нет токена сброса. Запросите письмо заново.
                </div>
                <p className="formFooter">
                    <Link className="link" to="/forgot">
                        Забыли пароль?
                    </Link>
                </p>
            </div>
        );
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        if (password !== confirm) {
            setError("Пароли не совпадают");
            return;
        }

        setPending(true);
        try {
            await authService.resetPassword(token, password, confirm);
            navigate("/signin", { replace: true, state: { passwordReset: true } });
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="formCard">
            <h1 className="formTitle">Новый пароль</h1>
            <p className="formSubtitle">
                Задайте новый пароль — все активные сессии будут завершены.
            </p>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="fieldLabel">Новый пароль</span>
                    <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        autoFocus
                        required
                    />
                    <span className="fieldHint">Минимум 8 символов.</span>
                </label>

                <label className="field">
                    <span className="fieldLabel">Повторите пароль</span>
                    <input
                        className="input"
                        type="password"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        autoComplete="new-password"
                        required
                    />
                </label>

                <button className="btn btnPrimary btnBlock" type="submit" disabled={pending}>
                    {pending ? "Сохраняем…" : "Сохранить пароль"}
                </button>
            </form>

            <p className="formFooter">
                <Link className="link" to="/signin">
                    Вернуться ко входу
                </Link>
            </p>
        </div>
    );
};

export default ResetPassword;
