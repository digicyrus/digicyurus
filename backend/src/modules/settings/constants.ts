export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const NOTIFICATION_CATEGORIES = ["invoices", "proposals", "agreements", "assets", "tasks"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = [] as const;
export const NOTIFICATION_DELIVERY = "unavailable" as const;

export const ESCALATION_PERMISSIONS = ["roles:update", "settings:update", "service_rates:update", "audit_logs:view"] as const;

export function isNotificationCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}
