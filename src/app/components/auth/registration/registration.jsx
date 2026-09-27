import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/auth.context";
import parseApiError from "../../../utils/api.error";

const EMPTY_FORM = {
    login: "",
    email: "",
    password: "",
    passwordConfirm: "",
};

const Registration = () => {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [form, setForm] = useState(EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const updateField = (field) => (event) =>
        setForm((previous) => ({ ...previous, [field]: event.target.value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setFieldErrors({});

        if (form.password !== form.passwordConfirm) {
            setFieldErrors({ password_confirm: "Пароли не совпадают" });
            return;
        }

        setPending(true);
        try {
            await register(form.login, form.email, form.password, form.passwordConfirm);
            navigate("/signin", { replace: true, state: { registered: true } });
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
            <h1 className="formTitle">Регистрация</h1>
            <p className="formSubtitle">
                Логин от 3 до 32 символов, пароль — не короче 8 символов
            </p>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="fieldLabel">Имя пользователя</span>
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
                    <span className="fieldLabel">Почта</span>
                    <input
                        className={`input${fieldErrors.email ? " inputInvalid" : ""}`}
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={updateField("email")}
                        autoComplete="email"
                        required
                    />
                    {fieldErrors.email && <span className="fieldError">{fieldErrors.email}</span>}
                </label>

                <label className="field">
                    <span className="fieldLabel">Пароль</span>
                    <input
                        className={`input${fieldErrors.password ? " inputInvalid" : ""}`}
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={updateField("password")}
                        autoComplete="new-password"
                        required
                    />
                    {fieldErrors.password && (
                        <span className="fieldError">{fieldErrors.password}</span>
                    )}
                </label>

                <label className="field">
                    <span className="fieldLabel">Повторите пароль</span>
                    <input
                        className={`input${fieldErrors.password_confirm ? " inputInvalid" : ""}`}
                        name="password_confirm"
                        type="password"
                        value={form.passwordConfirm}
                        onChange={updateField("passwordConfirm")}
                        autoComplete="new-password"
                        required
                    />
                    {fieldErrors.password_confirm && (
                        <span className="fieldError">{fieldErrors.password_confirm}</span>
                    )}
                </label>

                <button className="btn btnPrimary btnBlock" type="submit" disabled={pending}>
                    {pending ? "Создаём аккаунт..." : "Зарегистрироваться"}
                </button>
            </form>

            <p className="formFooter">
                Уже есть аккаунт?{" "}
                <Link className="link" to="/signin">
                    Войти
                </Link>
            </p>
        </div>
    );
};

export default Registration;
