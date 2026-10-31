import React from "react";
import { createRoot } from "react-dom/client";
import "./app/css/base.scss";
import App from "./app/app.jsx";
import { installErrorReporting } from "./app/utils/error.report";

installErrorReporting();

// Service worker только в проде: в разработке он мешает горячей перезагрузке.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`).catch(() => {
            // Офлайн-режим не критичен: без него приложение работает как обычно.
        });
    });
}

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

