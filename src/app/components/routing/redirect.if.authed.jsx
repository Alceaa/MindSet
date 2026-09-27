import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AUTH_STATUS } from "../../context/auth.context";
import LoadingScreen from "../common/loading.screen.jsx";

const RedirectIfAuthed = ({ children }) => {
    const { status } = useAuth();

    if (status === AUTH_STATUS.loading) {
        return <LoadingScreen />;
    }

    if (status === AUTH_STATUS.authenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default RedirectIfAuthed;
