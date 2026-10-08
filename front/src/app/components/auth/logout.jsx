import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth.context";

const Logout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pending, setPending] = useState(false);

    const handleLogout = async () => {
        setPending(true);
        await logout();
        navigate("/signin", { replace: true });
    };

    return (
        <div className="formCard formCardNarrow">
            <h1 className="formTitle">Выйти из аккаунта?</h1>
            <p className="formSubtitle">
                {user ? `Вы выходите как ${user.login}. ` : ""}
                Чтобы вернуться к заметкам, понадобится войти снова.
            </p>

            <div className="formActions">
                <button className="btn btnDanger btnBlock" onClick={handleLogout} disabled={pending}>
                    {pending ? "Выходим..." : "Выйти"}
                </button>
                <button className="btn btnGhost btnBlock" onClick={() => navigate(-1)}>
                    Остаться
                </button>
            </div>
        </div>
    );
};

export default Logout;
