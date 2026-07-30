import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
    head: () => ({
        meta: [
            { title: "Forgot password — DigiCyrus ERP" },
            { name: "description", content: "Request a secure password reset link for your DigiCyrus ERP account." },
            { property: "og:title", content: "Forgot password — DigiCyrus ERP" },
            { property: "og:description", content: "Reset access to your agency workspace." },
        ],
    }),
    component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
    const navigate = useNavigate();
    return (
        <AuthLayout
            title="Forgot password"
            subtitle="We'll email you a secure reset link"
            footer={
                <Link to="/login" className="font-medium text-primary hover:underline">
                    Back to sign in
                </Link>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.success("Reset link sent");
                    navigate({ to: "/reset-password" });
                }}
            >
                <div>
                    <Label className="text-xs text-muted-foreground">Work email</Label>
                    <Input className="mt-1.5" type="email" required />
                </div>
                <Button type="submit" className="w-full">
                    Send reset link
                </Button>
            </form>
        </AuthLayout>
    );
}
