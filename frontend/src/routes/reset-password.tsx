import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
    head: () => ({
        meta: [
            { title: "Reset password — DigiCyrus ERP" },
            { name: "description", content: "Set a new password for your DigiCyrus ERP agency workspace account." },
            { property: "og:title", content: "Reset password — DigiCyrus ERP" },
            { property: "og:description", content: "Choose a new password and sign back in." },
        ],
    }),
    component: ResetPasswordPage,
});

function ResetPasswordPage() {
    const navigate = useNavigate();
    return (
        <AuthLayout title="Set a new password" subtitle="Use at least 10 characters">
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.success("Password updated — please sign in");
                    navigate({ to: "/login" });
                }}
            >
                <div>
                    <Label className="text-xs text-muted-foreground">New password</Label>
                    <Input className="mt-1.5" type="password" required />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Confirm password</Label>
                    <Input className="mt-1.5" type="password" required />
                </div>
                <Button type="submit" className="w-full">
                    Update password
                </Button>
            </form>
        </AuthLayout>
    );
}
