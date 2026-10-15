import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
    title,
    subtitle,
    actions,
}: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}) {
    return (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold sm:text-3xl">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
    );
}

export function Panel({
    title,
    description,
    actions,
    className,
    children,
}: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn("surface p-5", className)}>
            {(title || actions) && (
                <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                        {title ? <h2 className="truncate text-sm font-semibold">{title}</h2> : null}
                        {description ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
                        ) : null}
                    </div>
                    {actions ? <div className="shrink-0">{actions}</div> : null}
                </div>
            )}
            {children}
        </section>
    );
}

const tones: Record<string, string> = {
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/15 text-warning",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
    info: "border-info/30 bg-info/10 text-info",
    neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: string }) {
    const map: Record<string, keyof typeof tones> = {
        Active: "success",
        Paid: "success",
        Won: "success",
        Completed: "success",
        "On Track": "success",
        Signed: "success",
        Running: "success",
        Published: "success",
        Pending: "warning",
        Draft: "neutral",
        "At Risk": "warning",
        "Due Soon": "warning",
        Due: "warning",
        Scheduled: "info",
        Sent: "info",
        Qualification: "info",
        Discovery: "info",
        Proposal: "info",
        Negotiation: "warning",
        Accepted: "success",
        Rejected: "danger",
        Expired: "danger",
        Terminated: "danger",
        Prospect: "info",
        "On Hold": "neutral",
        Paused: "neutral",
        Upcoming: "info",
        Overdue: "danger",
        Delayed: "danger",
        Missed: "danger",
        Lost: "danger",
        High: "danger",
        Medium: "warning",
        Low: "neutral",
    };
    return (
        <Badge variant="outline" className={cn("rounded-full font-medium", tones[map[status] ?? "neutral"])}>
            {status}
        </Badge>
    );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium">{title}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}
