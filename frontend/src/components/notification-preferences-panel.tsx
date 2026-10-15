import { useEffect, useState } from "react";

import { FormAlert } from "@/components/sales-form";
import { Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_DELIVERY_NOTE,
    blankNotificationCategories,
    notificationBody,
    notificationCategoriesFrom,
    settingsApi,
    type NotificationCategory,
} from "@/lib/settings";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    invoices: "Invoices",
    proposals: "Proposals",
    agreements: "Agreements",
    assets: "Assets",
    tasks: "Tasks",
};

export function NotificationPreferencesPanel() {
    const auth = useAuth();
    const [categories, setCategories] = useState(blankNotificationCategories());
    const [message, setMessage] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let activeRequest = true;
        setLoading(true);
        void settingsApi.notifications.get().then((preferences) => {
            if (!activeRequest) return;
            setCategories(notificationCategoriesFrom(preferences.categories));
            setMessage(null);
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
    }, [auth.refresh]);

    function toggle(key: NotificationCategory, checked: boolean) {
        setCategories((current) => ({ ...current, [key]: checked }));
        setSuccess(null);
    }

    async function save() {
        setSaving(true);
        setMessage(null);
        setSuccess(null);
        try {
            const saved = await settingsApi.notifications.update(notificationBody(categories));
            setCategories(notificationCategoriesFrom(saved.categories));
            setSuccess("Preferences saved. No notification was sent.");
        } catch (error: unknown) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Panel title="Notification preferences" description="Saved for the signed-in account">
            <p className="text-sm text-muted-foreground">{NOTIFICATION_DELIVERY_NOTE}</p>
            {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading preferences…</p> : null}
            {!loading && !loaded ? <div className="mt-3"><FormAlert message={message ?? "Notification preferences could not be loaded."} /></div> : null}
            {!loading && loaded ? (
                <div className="mt-4 space-y-4">
                    <div className="space-y-3">
                        {NOTIFICATION_CATEGORIES.map((key) => (
                            <div key={key} className="flex items-center justify-between gap-4 rounded-md border border-input px-3 py-2">
                                <Label htmlFor={`notification-${key}`}>{CATEGORY_LABELS[key]}</Label>
                                <Switch
                                    id={`notification-${key}`}
                                    checked={categories[key]}
                                    disabled={saving}
                                    onCheckedChange={(value) => toggle(key, value === true)}
                                />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Saving stores the preference. It does not send email, SMS, push, or an in-app notification.</p>
                    <FormAlert message={message} />
                    {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
                    <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save preferences"}</Button>
                </div>
            ) : null}
        </Panel>
    );
}
