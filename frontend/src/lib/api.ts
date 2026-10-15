export type LoginUser = {
    id: string;
    name: string;
    email: string;
    role: string;
};

export type SessionUser = LoginUser & {
    permissions: string[];
};

export type ApiErrorBody = {
    code: string;
    message: string;
    fields: Record<string, string>;
};

type Envelope<T> = {
    data: T | null;
    error: { code?: string; message?: string; fields?: Record<string, string> } | null;
};

export class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly fields: Record<string, string>;

    constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

export function resolveApiBaseUrl(value: string | undefined): string {
    const trimmed = value?.trim() ?? "";
    const base = trimmed.length > 0 ? trimmed : "http://localhost:4000";
    return base.replace(/\/+$/, "");
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createApiClient(options: { baseUrl: string; fetch?: FetchLike }) {
    const fetchImpl = options.fetch ?? fetch;
    const baseUrl = resolveApiBaseUrl(options.baseUrl);

    async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
        let response: Response;
        try {
            response = await fetchImpl(`${baseUrl}${path}`, {
                method: init?.method ?? "GET",
                credentials: "include",
                headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
                body: init?.body === undefined ? undefined : JSON.stringify(init.body),
            });
        } catch {
            throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
        }

        const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
        if (!response.ok || !payload || payload.error || payload.data === null) {
            const error = payload?.error;
            throw new ApiError(
                response.status,
                error?.code ?? "REQUEST_FAILED",
                error?.message ?? "Request failed",
                error?.fields ?? {},
            );
        }
        return payload.data;
    }

    return {
        request,
        login(email: string, password: string): Promise<LoginUser> {
            return request<LoginUser>("/api/auth/login", { method: "POST", body: { email, password } });
        },
        me(): Promise<SessionUser> {
            return request<SessionUser>("/api/auth/me");
        },
        logout(): Promise<{ status: string }> {
            return request<{ status: string }>("/api/auth/logout", { method: "POST" });
        },
    };
}

export const api = createApiClient({
    baseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_URL),
});
