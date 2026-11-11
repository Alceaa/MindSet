import React from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import Header from "../components/header.jsx";
import VerifyBanner from "../components/common/verify.banner.jsx";
import "../css/layout/layout.scss";

const AppLayout = () => {
    const location = useLocation();

    return (
        <div className="appShell">
            <a className="skipLink" href="#main">
                Перейти к содержимому
            </a>
            <Header />
            <VerifyBanner />
            <main className="appMain" id="main">
                <div className="appContainer">
                    <div className="routeFade" key={location.pathname}>
                        <Outlet />
                    </div>
                </div>
            </main>
            <footer className="appFooter">
                <span>MindSet — заметки-сеты со связями</span>
            </footer>
            <ScrollRestoration />
        </div>
    );
};

export default AppLayout;
