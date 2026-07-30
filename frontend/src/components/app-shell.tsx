import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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
    Bell,
    CalendarDays,
    Search,
    Sun,
    Moon,
    Menu,
    X,
    Sparkles,
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
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { currentUser, notifications, searchIndex } from "@/lib/mock-data";

const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/crm", label: "CRM", icon: Users },
    { to: "/leads", label: "Leads", icon: Target },
    { to: "/sales", label: "Sales", icon: TrendingUp },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/finance", label: "Finance", icon: Wallet },
    { to: "/marketing", label: "Marketing", icon: Megaphone },
    { to: "/hr", label: "HR", icon: UserCog },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/assets", label: "Assets", icon: Server },
    { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [cmdOpen, setCmdOpen] = useState(false);
    const { theme, toggle } = useTheme();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

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
                    {nav.map((item) => {
                        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
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
                                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                                <span className="truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
                    <p className="text-xs font-medium">Monthly goal</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="brand-gradient h-full w-[78%] rounded-full" />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">78% of ₹62L target</p>
                </div>
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

                    <button
                        onClick={() => setCmdOpen(true)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background sm:max-w-sm"
                    >
                        <Search className="h-4 w-4 shrink-0" />
                        <span className="truncate">Search everything…</span>
                        <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                            ⌘K
                        </kbd>
                    </button>

                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Calendar" asChild>
                            <Link to="/planner">
                                <CalendarDays className="h-4 w-4" />
                            </Link>
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                                    <Bell className="h-4 w-4" />
                                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80">
                                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {notifications.map((n) => (
                                    <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5">
                                        <span className="text-sm">{n.title}</span>
                                        <span className="text-xs text-muted-foreground">{n.time} ago</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="ml-1 flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-accent">
                                    <span className="brand-gradient grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-primary-foreground">
                                        {currentUser.initials}
                                    </span>
                                    <span className="hidden text-sm font-medium sm:inline">{currentUser.name}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="flex flex-col">
                                    <span>{currentUser.name}</span>
                                    <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/settings">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/planner">Daily planner</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/login">Sign out</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <main className="relative mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                            {currentUser.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            Role-based access · showing every module available to you
                        </span>
                    </div>
                    {children}
                </main>
            </div>

            <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
                <CommandInput placeholder="Search clients, leads, projects, invoices, employees…" />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {["Clients", "Leads", "Projects", "Invoices", "Employees"].map((group) => (
                        <CommandGroup key={group} heading={group}>
                            {searchIndex
                                .filter((i) => i.group === group)
                                .map((i) => (
                                    <CommandItem key={`${group}-${i.label}`} onSelect={() => setCmdOpen(false)} asChild>
                                        <Link to={i.to}>{i.label}</Link>
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </div>
    );
}
