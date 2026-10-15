import { createFileRoute, Link } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { ACCOUNT_WORKFLOW_MESSAGE } from "@/lib/navigation";

export const Route = createFileRoute("/forgot-password")({
    head: () => ({
        meta: [
            { title: "Forgot password — DigiCyrus ERP" },
            { name: "description", content: "Password reset is not available." },
            { property: "og:title", content: "Forgot password — DigiCyrus ERP" },
            { property: "og:description", content: "Password reset is not available." },
        ],
    }),
    component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
    return (
        <AuthLayout
            title="Forgot password"
            subtitle="Password reset is not available"
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
