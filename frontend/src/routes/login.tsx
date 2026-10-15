import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { loginErrorText } from "@/lib/auth-session";

export const Route = createFileRoute("/login")({
    head: () => ({
        meta: [
            { title: "Sign in — DigiCyrus ERP" },
            { name: "description", content: "Secure role-based sign in to the DigiCyrus agency management workspace." },
            { property: "og:title", content: "Sign in — DigiCyrus ERP" },
            { property: "og:description", content: "Role-based access for your agency team." },
        ],
    }),
    component: LoginPage,
});

function LoginPage() {
    const navigate = useNavigate();
    const auth = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    useEffect(() => {
        if (auth.status === "authenticated") {
            void navigate({ to: "/", replace: true });
        }
    }, [auth.status, navigate]);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        setEmailError(null);
        setPasswordError(null);
        try {
            await auth.login(email, password);
            await navigate({ to: "/", replace: true });
        } catch (error) {
            const text = loginErrorText(error);
            setFormError(text.form);
            setEmailError(text.email);
            setPasswordError(text.password);
        } finally {
            setSubmitting(false);
        }
    }

    const banner = formError ?? (auth.status === "expired" || auth.status === "error" ? auth.message : null);

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your agency workspace"
            footer={
                <span className="text-muted-foreground">Accounts are created by an administrator.</span>
            }
        >
            {auth.status === "loading" ? (
                <p className="text-sm text-muted-foreground">Checking your session…</p>
            ) : (
                <form className="space-y-4" onSubmit={onSubmit} noValidate>
                    {banner ? (
                        <p role="alert" className="text-sm text-destructive">
                            {banner}
                        </p>
                    ) : null}
                    <div>
                        <Label className="text-xs text-muted-foreground" htmlFor="email">Work email</Label>
                        <Input
                            id="email"
                            className="mt-1.5"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            aria-invalid={emailError ? true : undefined}
                            required
                        />
                        {emailError ? <p className="mt-1 text-xs text-destructive">{emailError}</p> : null}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground" htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            className="mt-1.5"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            aria-invalid={passwordError ? true : undefined}
                            required
                        />
                        {passwordError ? <p className="mt-1 text-xs text-destructive">{passwordError}</p> : null}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign in"}
                    </Button>
                </form>
            )}
        </AuthLayout>
    );
}
