import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AUTH_STATUS } from "../../context/auth.context";
import LoadingScreen from "../common/loading.screen.jsx";

const RootRedirect = () => {
    const { status } = useAuth();

    if (status === AUTH_STATUS.loading) {
        return <LoadingScreen />;
    }

    return (
        <Navigate to={status === AUTH_STATUS.authenticated ? "/dashboard" : "/signin"} replace />
    );
};

export default RootRedirect;
