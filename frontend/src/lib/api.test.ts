import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient, resolveApiBaseUrl } from "./api";
import { applyMeResult, initials, loginErrorText, SESSION_ENDED_MESSAGE } from "./auth-session";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

test("resolveApiBaseUrl uses the configured origin and drops a trailing slash", () => {
    assert.equal(resolveApiBaseUrl(undefined), "http://localhost:4000");
    assert.equal(resolveApiBaseUrl("  "), "http://localhost:4000");
    assert.equal(resolveApiBaseUrl("http://localhost:4000/"), "http://localhost:4000");
});

test("login sends cookies and only the email and password", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createApiClient({
        baseUrl: "http://localhost:4000/",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({
                data: { id: "user-1", name: "Ada Admin", email: "ada@digicyrus.example", role: "Super Admin" },
                error: null,
            });
        },
    });

    const user = await client.login("ada@digicyrus.example", "correct-password");
    assert.equal(user.role, "Super Admin");
    assert.equal(calls[0]?.url, "http://localhost:4000/api/auth/login");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.method, "POST");
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), null);
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        email: "ada@digicyrus.example",
        password: "correct-password",
    });
});

test("auth responses surface validation, authentication, and network errors", async () => {
    const client = createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (_url, init) => {
            const body = JSON.parse(String(init?.body ?? "{}")) as { password?: string };
            if (body.password === "short") {
                return jsonResponse({
                    data: null,
                    error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: { password: "Password must be at least 10 characters" } },
                }, 400);
            }
            if (body.password === "wrong-password") {
                return jsonResponse({ data: null, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password", fields: {} } }, 401);
            }
            throw new Error("offline");
        },
    });

    await assert.rejects(client.login("ada@digicyrus.example", "short"), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.fields.password, "Password must be at least 10 characters");
        assert.equal(loginErrorText(error).password, "Password must be at least 10 characters");
        assert.equal(loginErrorText(error).form, null);
        return true;
    });
    await assert.rejects(client.login("ada@digicyrus.example", "wrong-password"), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(loginErrorText(error).form, "Invalid email or password");
        return true;
    });
    await assert.rejects(client.login("ada@digicyrus.example", "correct-password"), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "NETWORK_ERROR");
        return true;
    });
});

test("session restore keeps permissions and treats a later 401 as expiry", async () => {
    const client = createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url) => {
            if (url.endsWith("/api/auth/me")) {
                return jsonResponse({
                    data: { id: "user-1", name: "Ada Admin", email: "ada@digicyrus.example", role: "Super Admin", permissions: ["audit_logs:view"] },
                    error: null,
                });
            }
            return jsonResponse({ data: { status: "logged_out" }, error: null });
        },
    });
    const user = await client.me();
    assert.deepEqual(user.permissions, ["audit_logs:view"]);
    assert.equal(initials(user.name), "AA");
    const authenticated = applyMeResult({ status: "loading", user: null, message: null }, { user });
    const expired = new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
    assert.deepEqual(applyMeResult(authenticated, { error: expired }), {
        status: "expired",
        user: null,
        message: SESSION_ENDED_MESSAGE,
    });
    assert.equal(applyMeResult({ status: "loading", user: null, message: null }, { error: expired }).status, "unauthenticated");
    const unavailable = new ApiError(500, "INTERNAL_ERROR", "Something went wrong");
    const kept = applyMeResult(authenticated, { error: unavailable });
    assert.equal(kept.status, "authenticated");
    assert.equal(kept.user?.id, "user-1");
    assert.equal(kept.message, "Something went wrong");
    assert.equal(applyMeResult({ status: "loading", user: null, message: null }, { error: unavailable }).status, "error");
    assert.equal((await client.logout()).status, "logged_out");
});

test("the api client does not store the session", async () => {
    const storage = {
        getItem() {
            throw new Error("storage read");
        },
        setItem() {
            throw new Error("storage write");
        },
        removeItem() {
            throw new Error("storage remove");
        },
    };
    const previousLocal = globalThis.localStorage;
    const previousSession = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
    try {
        const client = createApiClient({
            baseUrl: "http://localhost:4000",
            fetch: async () => jsonResponse({ data: { id: "user-1", name: "Ada Admin", email: "ada@digicyrus.example", role: "Admin" }, error: null }),
        });
        await client.login("ada@digicyrus.example", "correct-password");
    } finally {
        Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousLocal });
        Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: previousSession });
    }
});
