import React from "react";
import { Link, Outlet } from "react-router-dom";
import "../css/auth/auth.scss";

const AuthLayout = () => (
    <div className="authShell">
        <Link className="authBrand" to="/">
            <span className="brandMark">MS</span>
            <span className="brandName">MindSet</span>
        </Link>
        <Outlet />
        <p className="authHelp">Заметки-сеты со связями между ними</p>
    </div>
);

export default AuthLayout;
