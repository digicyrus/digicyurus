import { useEffect, useRef, useState } from "react";

import { FormAlert } from "@/components/sales-form";
import { Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import {
    PROTECTED_ROLE_KEY,
    canEditRolePermissions,
    canViewRoles,
    permissionCatalog,
    rolePermissionBody,
    settingsApi,
    type SettingsRole,
} from "@/lib/settings";

export function RolesPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewRoles(permissions);
    const [roles, setRoles] = useState<SettingsRole[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SettingsRole | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [detailMessage, setDetailMessage] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;

    useEffect(() => {
        if (!canView) {
            setRoles([]);
            setLoading(false);
            return;
        }
        let activeRequest = true;
        setLoading(true);
        void settingsApi.roles.list().then((result) => {
            if (!activeRequest) return;
            setRoles(result.roles);
            setSelectedId((current) => current ?? result.roles[0]?.id ?? null);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!activeRequest) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setRoles([]);
        }).finally(() => {
            if (activeRequest) setLoading(false);
        });
        return () => {
            activeRequest = false;
        };
    }, [canView, auth.refresh]);

    useEffect(() => {
        if (!canView || !selectedId) {
            setDetail(null);
            setSelected([]);
            setDetailLoading(false);
            return;
        }
        let activeRequest = true;
        setDetailLoading(true);
        void settingsApi.roles.get(selectedId).then((role) => {
            if (!activeRequest) return;
            setDetail(role);
            setSelected(role.permissions);
            setDetailMessage(null);
            setFieldError(null);
            setSuccess(null);
        }).catch((error: unknown) => {
            if (!activeRequest) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setDetail(null);
            setSelected([]);
            setDetailMessage(failure.message);
        }).finally(() => {
            if (activeRequest) setDetailLoading(false);
        });
        return () => {
            activeRequest = false;
        };
    }, [canView, selectedId, auth.refresh]);

    const catalog = permissionCatalog(roles);
    const editable = canEditRolePermissions(auth.user, detail);
    const protectedRole = detail?.key === PROTECTED_ROLE_KEY;

    function toggle(key: string, checked: boolean) {
        if (!editable) return;
        setSuccess(null);
        setSelected((current) => checked ? [...current, key] : current.filter((item) => item !== key));
    }

    async function save() {
        if (!detail || !editable || !catalog) return;
        const checked = rolePermissionBody(selected, catalog);
        if (!checked.ok) {
            setFieldError(checked.fields.permissions ?? checked.message);
            setDetailMessage(checked.message);
            setSuccess(null);
            return;
        }
        setSaving(true);
        setDetailMessage(null);
        setFieldError(null);
        setSuccess(null);
        try {
            const roleId = detail.id;
            const saved = await settingsApi.roles.replacePermissions(roleId, checked.body);
            try {
                const refreshed = await settingsApi.roles.get(saved.id);
                setRoles((current) => current.map((role) => role.id === refreshed.id ? refreshed : role));
                if (selectedIdRef.current !== roleId) return;
                setDetail(refreshed);
                setSelected(refreshed.permissions);
                setSuccess("Permissions saved.");
            } catch (error: unknown) {
                const failure = apiFailure(error);
                if (failure.status === 401) void auth.refresh();
                setRoles((current) => current.map((role) => role.id === saved.id ? saved : role));
                if (selectedIdRef.current !== roleId) return;
                setDetail(saved);
                setSelected(saved.permissions);
                setDetailMessage(`Permissions were saved, but the role details could not be reloaded. ${failure.message}`);
            }
        } catch (error: unknown) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setDetailMessage(failure.message);
            setFieldError(failure.fields.permissions ?? null);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Panel title="Roles & permissions" description={canView ? "Built-in roles and their permissions" : "Roles are not available for this account"}>
            {!canView ? <p className="text-sm text-muted-foreground">You do not have access to this.</p> : null}
            {canView && loading ? <p className="text-sm text-muted-foreground">Loading roles…</p> : null}
            {canView && !loading && message ? <FormAlert message={message} /> : null}
            {canView && !loading && !message ? (
                <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
                    <div className="space-y-2">
                        {roles.length === 0 ? <p className="text-sm text-muted-foreground">No roles returned.</p> : null}
                        {roles.map((role) => (
                            <button
                                key={role.id}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${role.id === selectedId ? "border-primary bg-muted" : "border-input"}`}
                                onClick={() => setSelectedId(role.id)}
                            >
                                <span>{role.name}</span>
                                {role.key === PROTECTED_ROLE_KEY ? <span className="text-xs text-muted-foreground">Protected</span> : null}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        {detailLoading ? <p className="text-sm text-muted-foreground">Loading role…</p> : null}
                        {!detailLoading && detail ? (
                            <>
                                <div>
                                    <h3 className="text-sm font-medium">{detail.name}</h3>
                                    <p className="text-xs text-muted-foreground">{detail.key}{detail.system ? " · Built-in" : ""}</p>
                                </div>
                                {protectedRole ? <p className="text-sm text-muted-foreground">The Super Admin role is protected and cannot be edited.</p> : null}
                                {!editable && !protectedRole ? <p className="text-sm text-muted-foreground">Only a Super Admin with permission to update roles can change permissions.</p> : null}
                                {catalog === null ? <FormAlert message="The permission catalog is not available." /> : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {catalog.map((key) => (
                                            <label key={key} className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={selected.includes(key)}
                                                    disabled={!editable || saving}
                                                    onCheckedChange={(value) => toggle(key, value === true)}
                                                />
                                                <span>{key}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
                                <FormAlert message={detailMessage} />
                                {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
                                {editable ? <Button type="button" disabled={saving || catalog === null} onClick={() => void save()}>{saving ? "Saving…" : "Save permissions"}</Button> : null}
                            </>
                        ) : null}
                        {!detailLoading && !detail ? <FormAlert message={detailMessage} /> : null}
                    </div>
                </div>
            ) : null}
        </Panel>
    );
}
