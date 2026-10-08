import React, { useState } from "react";
import authService from "../../api/auth.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";

const VerifyBanner = () => {
    const { user, isAuthenticated } = useAuth();

    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState("");
    const [hidden, setHidden] = useState(false);

    if (hidden || !isAuthenticated || !user || user.email_verified) {
        return null;
    }

    const resend = async () => {
        setPending(true);
        setNotice("");

        try {
            const data = await authService.requestEmailVerification(user.email);
            setNotice(data.message || "Письмо отправлено");
        } catch (err) {
            setNotice(parseApiError(err).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="verifyBanner" role="status">
            <div className="verifyBannerInner">
                <span className="verifyBannerText">
                    Почта <strong>{user.email}</strong> не подтверждена — проверьте письмо.
                    {notice && <span className="verifyBannerNotice"> {notice}</span>}
                </span>
                <div className="verifyBannerActions">
                    <button
                        className="btn btnSmall"
                        type="button"
                        onClick={resend}
                        disabled={pending}
                    >
                        {pending ? "Отправляем…" : "Отправить ещё раз"}
                    </button>
                    <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        onClick={() => setHidden(true)}
                    >
                        Скрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerifyBanner;
