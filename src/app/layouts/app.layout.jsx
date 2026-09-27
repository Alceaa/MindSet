import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/header.jsx";
import "../css/layout/layout.scss";

const AppLayout = () => (
    <div className="appShell">
        <Header />
        <main className="appMain">
            <div className="appContainer">
                <Outlet />
            </div>
        </main>
        <footer className="appFooter">
            <span>MindSet — заметки-сеты со связями</span>
        </footer>
    </div>
);

export default AppLayout;
