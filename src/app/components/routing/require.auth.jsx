import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AUTH_STATUS } from "../../context/auth.context";
import LoadingScreen from "../common/loading.screen.jsx";

const RequireAuth = ({ children }) => {
    const { status } = useAuth();
    const location = useLocation();

    if (status === AUTH_STATUS.loading) {
        return <LoadingScreen />;
    }

    if (status !== AUTH_STATUS.authenticated) {
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    return children;
};

export default RequireAuth;
