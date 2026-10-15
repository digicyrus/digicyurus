import { ApiError, type SessionUser } from "./api";

export const SESSION_ENDED_MESSAGE = "Your session has ended. Sign in again.";

export type AuthView =
    | { status: "loading"; user: null; message: null }
    | { status: "authenticated"; user: SessionUser; message: string | null }
    | { status: "unauthenticated"; user: null; message: null }
    | { status: "expired"; user: null; message: string }
    | { status: "error"; user: null; message: string };

export function initials(name: string): string {
    const letters = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "");
    return letters.join("") || "?";
}

export function loginErrorText(error: unknown): { form: string | null; email: string | null; password: string | null } {
    if (!(error instanceof ApiError)) {
        return { form: "Could not sign in", email: null, password: null };
    }
    const email = error.fields.email ?? null;
    const password = error.fields.password ?? null;
    return {
        form: email || password ? null : error.message,
        email,
        password,
    };
}

export function applyMeResult(current: AuthView, result: { user: SessionUser } | { error: ApiError }): AuthView {
    if ("user" in result) return { status: "authenticated", user: result.user, message: null };
    if (result.error.status === 401) {
        if (current.status === "authenticated") {
            return { status: "expired", user: null, message: SESSION_ENDED_MESSAGE };
        }
        return { status: "unauthenticated", user: null, message: null };
    }
    if (current.status === "authenticated") {
        return { status: "authenticated", user: current.user, message: result.error.message };
    }
    return { status: "error", user: null, message: result.error.message };
}
