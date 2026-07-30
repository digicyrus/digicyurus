import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { rolePermissions } from "@/lib/mock-data";

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
    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your agency workspace"
            footer={
                <>
                    New to DigiCyrus?{" "}
                    <Link to="/register" className="font-medium text-primary hover:underline">
                        Create an account
                    </Link>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.success("Signed in as Super Admin");
                    navigate({ to: "/" });
                }}
            >
                <div>
                    <Label className="text-xs text-muted-foreground">Work email</Label>
                    <Input className="mt-1.5" type="email" defaultValue="aarav@digicyrus.com" required />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <Input className="mt-1.5" type="password" defaultValue="demo-password" required />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Sign in as</Label>
                    <Select defaultValue="Super Admin">
                        <SelectTrigger className="mt-1.5 w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {rolePermissions.map((r) => (
                                <SelectItem key={r.role} value={r.role}>
                                    {r.role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                        Forgot password?
                    </Link>
                </div>
                <Button type="submit" className="w-full">
                    Sign in
                </Button>
            </form>
        </AuthLayout>
    );
}
