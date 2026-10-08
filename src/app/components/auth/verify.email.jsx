import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import authService from "../../api/auth.service";
import { useAuth } from "../../context/auth.context";
import parseApiError from "../../utils/api.error";

const VerifyEmail = () => {
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const [state, setState] = useState(token ? "pending" : "missing");
    const [failure, setFailure] = useState("");
    const started = useRef(false);

    useEffect(() => {
        if (!token || started.current) return;
        started.current = true;

        authService
            .verifyEmail(token)
            .then(async () => {
                setState("success");
                await refreshUser();
                navigate("/dashboard", { replace: true });
            })
            .catch((err) => {
                setFailure(parseApiError(err).message);
                setState("error");
            });
    }, [token, refreshUser, navigate]);

    return (
        <div className="formCard">
            <h1 className="formTitle">Подтверждение почты</h1>

            {state === "pending" && <p className="formSubtitle">Проверяем ссылку…</p>}

            {state === "success" && (
                <>
                    <div className="alert alertSuccess" role="status">
                        Почта подтверждена, аккаунт создан. Открываем приложение…
                    </div>
                    <p className="formFooter">
                        <Link className="link" to="/dashboard">
                            Перейти к заметкам
                        </Link>
                    </p>
                </>
            )}

            {state === "error" && (
                <>
                    <div className="alert alertError" role="alert">
                        {failure || "Ссылка недействительна или устарела."}
                    </div>
                    <p className="formFooter">
                        <Link className="link" to="/signup">
                            Зарегистрироваться заново
                        </Link>
                    </p>
                </>
            )}

            {state === "missing" && (
                <>
                    <div className="alert alertError" role="alert">
                        В ссылке нет токена подтверждения.
                    </div>
                    <p className="formFooter">
                        <Link className="link" to="/signin">
                            Вернуться ко входу
                        </Link>
                    </p>
                </>
            )}
        </div>
    );
};

export default VerifyEmail;
