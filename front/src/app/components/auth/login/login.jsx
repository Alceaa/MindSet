import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import authService from "../../../api/auth.service";
import { useAuth } from "../../../context/auth.context";
import parseApiError from "../../../utils/api.error";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, completeTwoFactorLogin } = useAuth();

    const [form, setForm] = useState({ login: "", password: "" });
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const [twoFactor, setTwoFactor] = useState(null);
    const [code, setCode] = useState("");
    const [verificationHint, setVerificationHint] = useState("");
    const [resendNotice, setResendNotice] = useState("");
    const [resending, setResending] = useState(false);

    const passwordReset = Boolean(location.state?.passwordReset);
    const redirectTo = location.state?.from?.pathname || "/dashboard";

    const updateField = (field) => (event) =>
        setForm((previous) => ({ ...previous, [field]: event.target.value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setFieldErrors({});
        setVerificationHint("");
        setResendNotice("");
        setPending(true);

        try {
            const result = await login(form.login, form.password);
            if (result?.two_factor_required) {
                setTwoFactor({ login: form.login, password: form.password, email: result.email });
                return;
            }
            navigate(redirectTo, { replace: true });
        } catch (err) {
            const parsed = parseApiError(err);
            setError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
            if (parsed.message.includes("активирован")) {
                setVerificationHint(form.login);
            }
        } finally {
            setPending(false);
        }
    };

    const handleConfirm = async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);

        try {
            await completeTwoFactorLogin(twoFactor.login, twoFactor.password, code);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setPending(false);
        }
    };

    const handleResendVerification = async () => {
        setResending(true);
        setResendNotice("");
        try {
            const data = await authService.requestEmailVerification(verificationHint);
            setResendNotice(data?.message || "Письмо отправлено повторно");
        } catch (err) {
            setResendNotice(parseApiError(err).message);
        } finally {
            setResending(false);
        }
    };

    if (twoFactor) {
        return (
            <div className="formCard">
                <h1 className="formTitle">Подтверждение входа</h1>
                <p className="formSubtitle">Код отправлен на {twoFactor.email || "вашу почту"}</p>

                {error && (
                    <div className="alert alertError" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleConfirm} noValidate>
                    <label className="field">
                        <span className="fieldLabel">Код из письма</span>
                        <input
                            className="input"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                            autoFocus
                            required
                        />
                        <span className="fieldHint">Шесть цифр, код действует 10 минут.</span>
                    </label>

                    <button className="btn btnPrimary btnBlock" type="submit" disabled={pending}>
                        {pending ? "Проверяем…" : "Войти"}
                    </button>
                </form>

                <p className="formFooter">
                    <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        onClick={() => {
                            setTwoFactor(null);
                            setCode("");
                            setError("");
                        }}
                    >
                        Вернуться назад
                    </button>
                </p>
            </div>
        );
    }

    return (
        <div className="formCard">
            <h1 className="formTitle">Вход в MindSet</h1>
            <p className="formSubtitle">Заметки-сеты, связанные между собой</p>

            {passwordReset && (
                <div className="alert alertSuccess" role="status">
                    Пароль обновлён. Войдите с новым паролем.
                </div>
            )}
            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            {verificationHint && (
                <div className="alert" role="status">
                    Аккаунт ещё не активирован. Проверьте письмо
                    {verificationHint.includes("@") ? ` на ${verificationHint}` : ""} или запросите
                    его заново.
                    {resendNotice && <div className="mutedText">{resendNotice}</div>}
                    {verificationHint.includes("@") && (
                        <button
                            className="btn btnSmall"
                            type="button"
                            onClick={handleResendVerification}
                            disabled={resending}
                        >
                            {resending ? "Отправляем…" : "Отправить письмо заново"}
                        </button>
                    )}
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
                <br />
                <Link className="link" to="/forgot">
                    Забыли пароль?
                </Link>
            </p>
        </div>
    );
};

export default Login;

