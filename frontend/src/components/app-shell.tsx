import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
    LayoutDashboard,
    Users,
    Target,
    TrendingUp,
    FolderKanban,
    Wallet,
    Megaphone,
    UserCog,
    BarChart3,
    Server,
    Settings,
    CalendarDays,
    Sun,
    Moon,
    Menu,
    X,
    Sparkles,
    type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/auth-session";
import { canOpenPlanner, visibleNav, type NavDestination } from "@/lib/navigation";

const navIcons: Record<NavDestination["to"], LucideIcon> = {
    "/": LayoutDashboard,
    "/crm": Users,
    "/leads": Target,
    "/sales": TrendingUp,
    "/projects": FolderKanban,
    "/finance": Wallet,
    "/marketing": Megaphone,
    "/hr": UserCog,
    "/reports": BarChart3,
    "/assets": Server,
    "/settings": Settings,
};

export function AppShell({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const { theme, toggle } = useTheme();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    useEffect(() => {
        if (auth.status === "unauthenticated" || auth.status === "expired") {
            void navigate({ to: "/login", replace: true });
        }
    }, [auth.status, navigate]);

    if (auth.status !== "authenticated" || !auth.user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="max-w-md text-center">
                    <p className="text-sm text-muted-foreground">
                        {auth.status === "error"
                            ? auth.message
                            : auth.status === "unauthenticated" || auth.status === "expired"
                              ? "Redirecting to sign in…"
                              : "Checking your session…"}
                    </p>
                    {auth.status === "error" ? (
                        <Button className="mt-4" onClick={() => void auth.refresh()}>
                            Try again
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    }

    const user = auth.user;
    const destinations = visibleNav(user.permissions);
    const showPlanner = canOpenPlanner(user.permissions);
    const showSettings = destinations.some((item) => item.to === "/settings");

    async function signOut() {
        setSigningOut(true);
        try {
            await auth.logout();
            await navigate({ to: "/login", replace: true });
        } catch {
            toast.error("Could not sign out");
            setSigningOut(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]"
            />

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full",
                )}
            >
                <div className="flex h-16 items-center gap-2 px-5">
                    <div className="brand-gradient grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">DigiCyrus</p>
                        <p className="truncate text-[11px] text-muted-foreground">Agency ERP</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto lg:hidden"
                        onClick={() => setOpen(false)}
                        aria-label="Close navigation"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
                    {destinations.map((item) => {
                        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                        const Icon = navIcons[item.to];
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                                )}
                            >
                                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                                <span className="truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {open ? (
                <button
                    aria-label="Close navigation overlay"
                    className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
                    onClick={() => setOpen(false)}
                />
            ) : null}

            {/* Main */}
            <div className="lg:pl-64">
                <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setOpen(true)}
                        aria-label="Open navigation"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>

                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        {showPlanner ? (
                            <Button variant="ghost" size="icon" aria-label="Calendar" asChild>
                                <Link to="/planner">
                                    <CalendarDays className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : null}

                        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="ml-1 flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-accent">
                                    <span className="brand-gradient grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-primary-foreground">
                                        {initials(user.name)}
                                    </span>
                                    <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="flex flex-col">
                                    <span>{user.name}</span>
                                    <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {showSettings ? (
                                    <DropdownMenuItem asChild>
                                        <Link to="/settings">Settings</Link>
                                    </DropdownMenuItem>
                                ) : null}
                                {showPlanner ? (
                                    <DropdownMenuItem asChild>
                                        <Link to="/planner">Daily planner</Link>
                                    </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
                                    {signingOut ? "Signing out…" : "Sign out"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <main className="relative mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                            {user.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            Showing the modules this account can open
                        </span>
                        {auth.message ? <span className="text-xs text-destructive">{auth.message}</span> : null}
                    </div>
                    {children}
                </main>
            </div>
        </div>
    );
}
