import React from "react";

const LoadingScreen = ({ label = "Проверяем сессию..." }) => (
    <div className="loadingScreen">
        <div className="spinner" aria-hidden="true" />
        <span className="loadingLabel">{label}</span>
    </div>
);

export default LoadingScreen;
