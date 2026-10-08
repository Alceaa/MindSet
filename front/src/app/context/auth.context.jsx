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
        if (data.two_factor_required) {
            return data;
        }
        setUser(data.user);
        setStatus(AUTH_STATUS.authenticated);
        return data.user;
    }, []);

    const completeTwoFactorLogin = useCallback(async (loginValue, password, code) => {
        const data = await authService.confirmLogin(loginValue, password, code);
        setUser(data.user);
        setStatus(AUTH_STATUS.authenticated);
        return data.user;
    }, []);

    const register = useCallback(async (loginValue, email, password, passwordConfirm, invite) => {
        return authService.register(loginValue, email, password, passwordConfirm, invite);
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

    const refreshUser = useCallback(async () => {
        try {
            const data = await authService.me();
            setUser(data.user ?? null);
            setStatus(AUTH_STATUS.authenticated);
            return data.user;
        } catch (error) {
            return null;
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            status,
            isAuthenticated: status === AUTH_STATUS.authenticated,
            isLoading: status === AUTH_STATUS.loading,
            login,
            completeTwoFactorLogin,
            register,
            logout,
            updateUser,
            refreshUser,
        }),
        [user, status, login, completeTwoFactorLogin, register, logout, updateUser, refreshUser]
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
