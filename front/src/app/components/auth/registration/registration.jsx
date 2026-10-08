import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import authService from "../../../api/auth.service";
import { useAuth } from "../../../context/auth.context";
import parseApiError from "../../../utils/api.error";

const EMPTY_FORM = {
    login: "",
    email: "",
    password: "",
    passwordConfirm: "",
};

const Registration = () => {
    const { register } = useAuth();
    const [params] = useSearchParams();
    const invite = params.get("invite") || "";

    const [form, setForm] = useState(EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const [sentTo, setSentTo] = useState("");
    const [resendNotice, setResendNotice] = useState("");
    const [resending, setResending] = useState(false);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        authService
            .registrationConfig()
            .then((data) => setClosed(Boolean(data.invite_only) && !invite))
            .catch(() => setClosed(false));
    }, [invite]);

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
            const data = await register(form.login, form.email, form.password, form.passwordConfirm, invite);
            setSentTo(data?.email || form.email);
        } catch (err) {
            const parsed = parseApiError(err);
            setError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
        } finally {
            setPending(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setResendNotice("");
        try {
            const data = await authService.requestEmailVerification(sentTo);
            setResendNotice(data?.message || "Письмо отправлено повторно");
        } catch (err) {
            setResendNotice(parseApiError(err).message);
        } finally {
            setResending(false);
        }
    };

    if (closed) {
        return (
            <div className="formCard">
                <h1 className="formTitle">Регистрация по приглашению</h1>
                <p className="formSubtitle">Новые аккаунты создаются только по персональным ссылкам</p>

                <div className="alert" role="status">
                    Если у вас есть ссылка-приглашение, откройте её: она ведёт на страницу регистрации
                    с параметром <span className="visibilitySlug">?invite=…</span>
                </div>

                <p className="formFooter">
                    Уже есть аккаунт?{" "}
                    <Link className="link" to="/signin">
                        Войти
                    </Link>
                </p>
            </div>
        );
    }

    if (sentTo) {
        return (
            <div className="formCard">
                <h1 className="formTitle">Подтвердите почту</h1>
                <p className="formSubtitle">Аккаунт появится после перехода по ссылке из письма</p>

                <div className="alert alertSuccess" role="status">
                    Мы отправили письмо на <strong>{sentTo}</strong>. Ссылка действует 24 часа.
                </div>

                {resendNotice && (
                    <div className="alert" role="status">
                        {resendNotice}
                    </div>
                )}

                <button
                    className="btn btnBlock"
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                >
                    {resending ? "Отправляем…" : "Отправить письмо ещё раз"}
                </button>

                <p className="formFooter">
                    Уже подтвердили?{" "}
                    <Link className="link" to="/signin">
                        Войти
                    </Link>
                </p>
            </div>
        );
    }

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
                    <span className="fieldHint">На неё придёт ссылка подтверждения.</span>
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
                    {pending ? "Отправляем письмо..." : "Зарегистрироваться"}
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
