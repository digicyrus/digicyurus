export type NavDestination = {
    to: "/" | "/crm" | "/leads" | "/sales" | "/projects" | "/finance" | "/marketing" | "/hr" | "/reports" | "/assets" | "/settings";
    label: string;
    anyOf: readonly string[];
};

export const NAV_DESTINATIONS: readonly NavDestination[] = [
    { to: "/", label: "Dashboard", anyOf: ["dashboard:view"] },
    { to: "/crm", label: "CRM", anyOf: ["clients:view"] },
    { to: "/leads", label: "Leads", anyOf: ["leads:view"] },
    { to: "/sales", label: "Sales", anyOf: ["sales:view"] },
    { to: "/projects", label: "Projects", anyOf: ["projects:view", "tasks:view"] },
    { to: "/finance", label: "Finance", anyOf: ["finance:view", "invoices:view", "expenses:view", "referrals:view"] },
    { to: "/marketing", label: "Marketing", anyOf: ["campaigns:view", "content:view"] },
    { to: "/hr", label: "HR", anyOf: ["employees:view", "attendance:view"] },
    { to: "/reports", label: "Reports", anyOf: ["reports:view"] },
    { to: "/assets", label: "Assets", anyOf: ["assets:view"] },
    { to: "/settings", label: "Settings", anyOf: ["settings:view", "service_rates:view"] },
];

export const ACCOUNT_WORKFLOW_MESSAGE = "Account registration and password reset are not available. An administrator creates sign-in accounts.";

export function accountWorkflowAvailable(): false {
    return false;
}

export function visibleNav(permissions: readonly string[]): NavDestination[] {
    return NAV_DESTINATIONS.filter((item) => item.anyOf.some((key) => permissions.includes(key)));
}

export function canOpenPlanner(permissions: readonly string[]): boolean {
    return permissions.includes("planner:view");
}
