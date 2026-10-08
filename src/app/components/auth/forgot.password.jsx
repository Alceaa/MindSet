import React, { useState } from "react";
import { Link } from "react-router-dom";
import authService from "../../api/auth.service";
import parseApiError from "../../utils/api.error";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);

        try {
            await authService.forgotPassword(email);
            setSent(true);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setPending(false);
        }
    };

    if (sent) {
        return (
            <div className="formCard">
                <h1 className="formTitle">Письмо отправлено</h1>
                <div className="alert alertSuccess" role="status">
                    Если адрес <strong>{email}</strong> зарегистрирован, письмо со ссылкой для
                    сброса пароля уже отправлено. Ссылка действует один час.
                </div>
                <p className="formFooter">
                    <Link className="link" to="/signin">
                        Вернуться ко входу
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <div className="formCard">
            <h1 className="formTitle">Забыли пароль?</h1>
            <p className="formSubtitle">
                Укажите почту аккаунта — пришлём ссылку для установки нового пароля.
            </p>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="fieldLabel">Почта</span>
                    <input
                        className="input"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        autoFocus
                        required
                    />
                </label>

                <button className="btn btnPrimary btnBlock" type="submit" disabled={pending}>
                    {pending ? "Отправляем…" : "Отправить ссылку"}
                </button>
            </form>

            <p className="formFooter">
                Вспомнили пароль?{" "}
                <Link className="link" to="/signin">
                    Войти
                </Link>
            </p>
        </div>
    );
};

export default ForgotPassword;
