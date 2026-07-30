import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
    head: () => ({
        meta: [
            { title: "Create account — DigiCyrus ERP" },
            { name: "description", content: "Create a DigiCyrus ERP account and start managing your agency operations." },
            { property: "og:title", content: "Create account — DigiCyrus ERP" },
            { property: "og:description", content: "Set up your agency workspace in minutes." },
        ],
    }),
    component: RegisterPage,
});

function RegisterPage() {
    const navigate = useNavigate();
    return (
        <AuthLayout
            title="Create your workspace"
            subtitle="14-day trial · no card required"
            footer={
                <>
                    Already have an account?{" "}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                        Sign in
                    </Link>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.success("Verification email sent — check your inbox");
                    navigate({ to: "/login" });
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <Label className="text-xs text-muted-foreground">Full name</Label>
                        <Input className="mt-1.5" required />
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Agency name</Label>
                        <Input className="mt-1.5" required />
                    </div>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Work email</Label>
                    <Input className="mt-1.5" type="email" required />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <Input className="mt-1.5" type="password" required />
                </div>
                <Button type="submit" className="w-full">
                    Create account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                    We'll email a verification link before your first sign in.
                </p>
            </form>
        </AuthLayout>
    );
}
