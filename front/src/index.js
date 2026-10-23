import React from "react";
import { createRoot } from "react-dom/client";
import "./app/css/base.scss";
import App from "./app/app.jsx";
import { installErrorReporting } from "./app/utils/error.report";

installErrorReporting();

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

