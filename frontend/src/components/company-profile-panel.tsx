import { useEffect, useState, type FormEvent } from "react";

import { FormAlert, TextField } from "@/components/sales-form";
import { Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDateTime } from "@/lib/crm";
import {
    blankCompanyForm,
    canEditCompany,
    canViewCompany,
    companyBody,
    companyFormFrom,
    settingsApi,
    type CompanyForm,
} from "@/lib/settings";

export function CompanyProfilePanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewCompany(permissions);
    const canEdit = canEditCompany(auth.user);
    const [form, setForm] = useState<CompanyForm>(blankCompanyForm());
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!canView) {
            setLoaded(false);
            setLoading(false);
            return;
        }
        let activeRequest = true;
        setLoading(true);
        void settingsApi.company.get().then((profile) => {
            if (!activeRequest) return;
            setForm(companyFormFrom(profile));
            setUpdatedAt(profile.updatedAt);
            setMessage(null);
            setFields({});
            setLoaded(true);
        }).catch((error: unknown) => {
            if (!activeRequest) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setLoaded(false);
        }).finally(() => {
            if (activeRequest) setLoading(false);
        });
        return () => {
            activeRequest = false;
        };
    }, [canView, auth.refresh]);

    function change(key: keyof CompanyForm, value: string) {
        setForm((current) => ({ ...current, [key]: value }));
        setSuccess(null);
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!canEdit) return;
        const checked = companyBody(form);
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            setSuccess(null);
            return;
        }
        setSaving(true);
        setMessage(null);
        setSuccess(null);
        setFields({});
        try {
            const saved = await settingsApi.company.update(checked.body);
            setForm(companyFormFrom(saved));
            setUpdatedAt(saved.updatedAt);
            setSuccess("Company profile saved.");
        } catch (error: unknown) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setFields(failure.fields);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Panel title="Company profile" description={canEdit ? "Saved company details" : "Company details are read-only for this account"}>
            {!canView ? <p className="text-sm text-muted-foreground">You do not have access to this.</p> : null}
            {canView && loading ? <p className="text-sm text-muted-foreground">Loading company profile…</p> : null}
            {canView && !loading && !loaded ? <FormAlert message={message ?? "Company profile could not be loaded."} /> : null}
            {canView && loaded ? (
                <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
                    {!canEdit ? <p className="text-sm text-muted-foreground">Only a Super Admin with permission to update settings can edit this profile.</p> : null}
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Legal name" value={form.legalName} error={fields.legalName} disabled={!canEdit || saving} onChange={(value) => change("legalName", value)} />
                        <TextField label="Brand name" value={form.brandName} error={fields.brandName} disabled={!canEdit || saving} onChange={(value) => change("brandName", value)} />
                        <TextField label="GSTIN" value={form.gstin} error={fields.gstin} disabled={!canEdit || saving} onChange={(value) => change("gstin", value)} />
                        <TextField label="Billing email" value={form.billingEmail} error={fields.billingEmail} type="email" disabled={!canEdit || saving} onChange={(value) => change("billingEmail", value)} />
                        <TextField label="Address line 1" value={form.addressLine1} error={fields.addressLine1} disabled={!canEdit || saving} onChange={(value) => change("addressLine1", value)} />
                        <TextField label="Address line 2" value={form.addressLine2} error={fields.addressLine2} disabled={!canEdit || saving} onChange={(value) => change("addressLine2", value)} />
                        <TextField label="City" value={form.city} error={fields.city} disabled={!canEdit || saving} onChange={(value) => change("city", value)} />
                        <TextField label="State" value={form.state} error={fields.state} disabled={!canEdit || saving} onChange={(value) => change("state", value)} />
                        <TextField label="Postal code" value={form.postalCode} error={fields.postalCode} disabled={!canEdit || saving} onChange={(value) => change("postalCode", value)} />
                        <TextField label="Country" value={form.country} error={fields.country} disabled={!canEdit || saving} onChange={(value) => change("country", value)} />
                    </div>
                    {updatedAt ? <p className="text-xs text-muted-foreground">Last saved {formatDateTime(updatedAt)}</p> : null}
                    <FormAlert message={message} />
                    {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
                    {canEdit ? <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button> : null}
                </form>
            ) : null}
        </Panel>
    );
}
