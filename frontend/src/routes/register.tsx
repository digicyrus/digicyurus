import { createFileRoute, Link } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { ACCOUNT_WORKFLOW_MESSAGE } from "@/lib/navigation";

export const Route = createFileRoute("/register")({
    head: () => ({
        meta: [
            { title: "Create account — DigiCyrus ERP" },
            { name: "description", content: "Account registration is not available." },
            { property: "og:title", content: "Create account — DigiCyrus ERP" },
            { property: "og:description", content: "Account registration is not available." },
        ],
    }),
    component: RegisterPage,
});

function RegisterPage() {
    return (
        <AuthLayout
            title="Create an account"
            subtitle="Registration is not available"
            footer={
                <Link to="/login" className="font-medium text-primary hover:underline">
                    Back to sign in
                </Link>
            }
        >
            <p className="text-sm text-muted-foreground">{ACCOUNT_WORKFLOW_MESSAGE}</p>
        </AuthLayout>
    );
}
