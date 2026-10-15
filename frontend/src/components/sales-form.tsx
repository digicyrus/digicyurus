import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const selectClass = "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground";

export function FormAlert({ message }: { message: string | null }) {
    if (!message) return null;
    return <p role="alert" className="text-sm text-destructive">{message}</p>;
}

export function TextField({
    label,
    value,
    error,
    onChange,
    type = "text",
    required = false,
    disabled = false,
}: {
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    disabled?: boolean;
}) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

export function AreaField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Textarea className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

export function ChoiceField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="block text-xs text-muted-foreground">{label}
            <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
                {options.map((option) => <option key={option}>{option}</option>)}
            </select>
        </label>
    );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
            </div>
        </div>
    );
}

export function Notice({ children }: { children: ReactNode }) {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}
