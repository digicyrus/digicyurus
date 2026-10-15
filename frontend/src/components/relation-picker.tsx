import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import { displayOptions, hasMore, RELATION_PAGE_SIZE, appendOptions, type RelationOption, type RelationPage } from "@/lib/relations";

export function useResolvedLabels(ids: readonly (string | null | undefined)[], enabled: boolean, lookup: (id: string) => Promise<string>): Record<string, string | null> {
    const [labels, setLabels] = useState<Record<string, string | null>>({});
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
    const missingKey = wanted.filter((id) => !(id in labels)).join(",");

    useEffect(() => {
        if (!enabled || !missingKey) return;
        const list = missingKey.split(",");
        let active = true;
        void Promise.all(list.map(async (id) => {
            try {
                return [id, await lookup(id)] as const;
            } catch {
                return [id, null] as const;
            }
        })).then((entries) => {
            if (!active) return;
            setLabels((current) => {
                const next = { ...current };
                for (const [id, label] of entries) next[id] = label;
                return next;
            });
        });
        return () => {
            active = false;
        };
    }, [enabled, lookup, missingKey]);

    if (!enabled) {
        return Object.fromEntries(wanted.map((id) => [id, null]));
    }
    return labels;
}

export function RelationPicker({
    label,
    value,
    onChange,
    load,
    enabled = true,
    required = false,
    emptyLabel,
    selectedLabel,
    resetKey = "",
    unavailable = "This list is not available for this role.",
}: {
    label: string;
    value: string;
    onChange: (id: string) => void;
    load: (query: { page: number; pageSize: number; search?: string }) => Promise<RelationPage>;
    enabled?: boolean;
    required?: boolean;
    emptyLabel: string;
    selectedLabel?: string | null;
    resetKey?: string;
    unavailable?: string;
}) {
    const auth = useAuth();
    const loadRef = useRef(load);
    loadRef.current = load;
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [options, setOptions] = useState<RelationOption[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSearch("");
        setQuery("");
        setPage(1);
        setOptions([]);
        setTotal(0);
        setError(null);
    }, [resetKey]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!enabled) return;
        let active = true;
        setLoading(true);
        void loadRef.current({ page, pageSize: RELATION_PAGE_SIZE, search: query || undefined }).then((result) => {
            if (!active) return;
            setOptions((current) => page <= 1 ? result.items : appendOptions(current, result.items));
            setTotal(result.total);
            setError(null);
        }).catch((caught: unknown) => {
            if (!active) return;
            const failure = apiFailure(caught);
            if (failure.status === 401) void auth.refresh();
            setError(failure.message);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [enabled, page, query, resetKey, auth.refresh]);

    const known = options.find((option) => option.id === value)?.label;
    const chosen = selectedLabel || known || (selectedLabel === null ? "Name unavailable" : "Loading name…");
    const visible = displayOptions(options, value ? { id: value, label: chosen } : null);
    const more = hasMore(page, RELATION_PAGE_SIZE, total);

    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {enabled ? (
                <>
                    <Input className="mt-1" placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={(event) => setSearch(event.target.value)} />
                    <select aria-label={label} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={value} required={required} onChange={(event) => onChange(event.target.value)}>
                        <option value="">{emptyLabel}</option>
                        {visible.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    {more ? (
                        <Button className="mt-2" type="button" variant="outline" size="sm" disabled={loading} onClick={() => setPage((current) => current + 1)}>
                            Load more ({options.length} of {total})
                        </Button>
                    ) : null}
                    {loading ? <p className="mt-1 text-xs text-muted-foreground">Loading {label.toLowerCase()}…</p> : null}
                    {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
                </>
            ) : <p className="mt-1 text-sm text-muted-foreground">{unavailable}</p>}
        </div>
    );
}
