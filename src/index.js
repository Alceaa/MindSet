import React from "react";
import { createRoot } from "react-dom/client";
import "./app/css/base.scss";
import App from "./app/app.jsx";

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

