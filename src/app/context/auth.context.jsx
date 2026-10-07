import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authService from "../api/auth.service";
import { AUTH_EVENTS } from "../api/api";

export const AUTH_STATUS = {
    loading: "loading",
    authenticated: "authenticated",
    anonymous: "anonymous",
};

const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState(AUTH_STATUS.loading);
    useEffect(() => {
        let active = true;

        authService
            .me()
            .then((data) => {
                if (!active) return;
                setUser(data.user);
                setStatus(AUTH_STATUS.authenticated);
            })
            .catch(() => {
                if (!active) return;
                setUser(null);
                setStatus(AUTH_STATUS.anonymous);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => {
            setUser(null);
            setStatus(AUTH_STATUS.anonymous);
        };

        window.addEventListener(AUTH_EVENTS.unauthorized, handleUnauthorized);
        return () => window.removeEventListener(AUTH_EVENTS.unauthorized, handleUnauthorized);
    }, []);

    const login = useCallback(async (loginValue, password) => {
        const data = await authService.login(loginValue, password);
        setUser(data.user);
        setStatus(AUTH_STATUS.authenticated);
        return data.user;
    }, []);

    const register = useCallback(async (loginValue, email, password, passwordConfirm) => {
        const data = await authService.register(loginValue, email, password, passwordConfirm);
        return data.user;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch (error) {
        }
        setUser(null);
        setStatus(AUTH_STATUS.anonymous);
    }, []);

    const updateUser = useCallback((nextUser) => {
        setUser(nextUser ?? null);
    }, []);

    const value = useMemo(
        () => ({
            user,
            status,
            isAuthenticated: status === AUTH_STATUS.authenticated,
            isLoading: status === AUTH_STATUS.loading,
            login,
            register,
            logout,
            updateUser,
        }),
        [user, status, login, register, logout, updateUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth должен вызываться внутри AuthProvider");
    }
    return context;
};

export default AuthContext;
