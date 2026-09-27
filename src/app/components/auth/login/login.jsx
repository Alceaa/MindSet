import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/auth.context";
import parseApiError from "../../../utils/api.error";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const [form, setForm] = useState({ login: "", password: "" });
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const justRegistered = Boolean(location.state?.registered);

    const updateField = (field) => (event) =>
        setForm((previous) => ({ ...previous, [field]: event.target.value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setFieldErrors({});
        setPending(true);

        try {
            await login(form.login, form.password);
            const redirectTo = location.state?.from?.pathname || "/dashboard";
            navigate(redirectTo, { replace: true });
        } catch (err) {
            const parsed = parseApiError(err);
            setError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="formCard">
            <h1 className="formTitle">Вход в MindSet</h1>
            <p className="formSubtitle">Заметки-сеты, связанные между собой</p>

            {justRegistered && (
                <div className="alert alertSuccess" role="status">
                    Аккаунт создан. Войдите с новыми данными.
                </div>
            )}
            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="fieldLabel">Имя пользователя или почта</span>
                    <input
                        className={`input${fieldErrors.login ? " inputInvalid" : ""}`}
                        name="login"
                        type="text"
                        value={form.login}
                        onChange={updateField("login")}
                        autoComplete="username"
                        autoFocus
                        required
                    />
                    {fieldErrors.login && <span className="fieldError">{fieldErrors.login}</span>}
                </label>

                <label className="field">
                    <span className="fieldLabel">Пароль</span>
                    <input
                        className={`input${fieldErrors.password ? " inputInvalid" : ""}`}
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={updateField("password")}
                        autoComplete="current-password"
                        required
                    />
                    {fieldErrors.password && (
                        <span className="fieldError">{fieldErrors.password}</span>
                    )}
                </label>

                <button className="btn btnPrimary btnBlock" type="submit" disabled={pending}>
                    {pending ? "Входим..." : "Войти"}
                </button>
            </form>

            <p className="formFooter">
                Нет аккаунта?{" "}
                <Link className="link" to="/signup">
                    Зарегистрироваться
                </Link>
            </p>
        </div>
    );
};

export default Login;
