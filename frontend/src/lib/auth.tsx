import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ApiError, api, type SessionUser } from "./api";
import { applyMeResult, type AuthView } from "./auth-session";

const COOKIE_NOT_SAVED = "The session cookie was not saved. This site must be allowed by the API.";

type AuthContextValue = {
    status: AuthView["status"];
    user: SessionUser | null;
    message: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [view, setView] = useState<AuthView>({ status: "loading", user: null, message: null });
    const requestId = useRef(0);
    const statusRef = useRef(view.status);
    statusRef.current = view.status;

    const refresh = useCallback(async () => {
        const id = ++requestId.current;
        try {
            const user = await api.me();
            if (id !== requestId.current) return;
            setView({ status: "authenticated", user, message: null });
        } catch (error) {
            if (id !== requestId.current) return;
            const apiError = error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
            setView((current) => applyMeResult(current, { error: apiError }));
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const onFocus = () => {
            if (statusRef.current === "authenticated") void refresh();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [refresh]);

    const login = useCallback(async (email: string, password: string) => {
        await api.login(email, password);
        requestId.current += 1;
        try {
            const user = await api.me();
            setView({ status: "authenticated", user, message: null });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                throw new ApiError(401, "AUTHENTICATION_REQUIRED", COOKIE_NOT_SAVED);
            }
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        const id = ++requestId.current;
        await api.logout();
        if (id !== requestId.current) return;
        setView({ status: "unauthenticated", user: null, message: null });
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        status: view.status,
        user: view.user,
        message: view.message,
        login,
        logout,
        refresh,
    }), [view, login, logout, refresh]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const value = useContext(AuthContext);
    if (!value) throw new Error("AuthProvider is missing");
    return value;
}
