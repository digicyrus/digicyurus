import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AuthLayout({
    title,
    subtitle,
    children,
    footer,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]"
            />
            <div className="glass relative w-full max-w-md rounded-2xl p-8">
                <Link to="/" className="mb-6 flex items-center gap-2">
                    <span className="brand-gradient grid h-8 w-8 place-items-center rounded-lg">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                    </span>
                    <span className="text-sm font-semibold">DigiCyrus ERP</span>
                </Link>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                <div className="mt-6">{children}</div>
                {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
            </div>
        </div>
    );
}
