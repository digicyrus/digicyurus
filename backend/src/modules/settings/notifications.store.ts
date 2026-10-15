import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { notificationPreferences, users } from "../../db/schema/index.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_DELIVERY, isNotificationCategory, type NotificationCategory } from "./constants.js";
import type { UpdateNotificationBody } from "./notifications.schema.js";

export type NotificationPreferenceRecord = {
  delivery: typeof NOTIFICATION_DELIVERY;
  channels: [];
  categories: Record<NotificationCategory, boolean>;
};

export type NotificationStore = {
  get(organizationId: string, userId: string): Promise<NotificationPreferenceRecord | null>;
  update(
    organizationId: string,
    userId: string,
    patch: UpdateNotificationBody,
    audit?: AuditRequest | null,
  ): Promise<NotificationPreferenceRecord | null>;
};

export function blankNotificationPreferences(): NotificationPreferenceRecord {
  return {
    delivery: NOTIFICATION_DELIVERY,
    channels: [],
    categories: {
      invoices: false,
      proposals: false,
      agreements: false,
      assets: false,
      tasks: false,
    },
  };
}

export function mergeCategories(
  stored: readonly { category: string; enabled: boolean }[],
  patch?: UpdateNotificationBody["categories"],
): Record<NotificationCategory, boolean> {
  const categories = blankNotificationPreferences().categories;
  for (const row of stored) {
    if (isNotificationCategory(row.category)) categories[row.category] = row.enabled;
  }
  if (!patch) return categories;
  for (const category of NOTIFICATION_CATEGORIES) {
    const value = patch[category];
    if (value !== undefined) categories[category] = value;
  }
  return categories;
}

export function createDrizzleNotificationStore(database: Database): NotificationStore {
  const { db } = database;
  return {
    async get(organizationId, userId) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
        .limit(1);
      if (!user) return null;
      const rows = await db
        .select({ category: notificationPreferences.category, enabled: notificationPreferences.enabled })
        .from(notificationPreferences)
        .where(and(eq(notificationPreferences.organizationId, organizationId), eq(notificationPreferences.userId, userId)));
      return { delivery: NOTIFICATION_DELIVERY, channels: [], categories: mergeCategories(rows) };
    },
    async update(organizationId, userId, patch, audit) {
      return db.transaction(async (tx) => {
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
          .limit(1)
          .for("update");
        if (!user) return null;
        const existing = await tx
          .select({ category: notificationPreferences.category, enabled: notificationPreferences.enabled })
          .from(notificationPreferences)
          .where(and(eq(notificationPreferences.organizationId, organizationId), eq(notificationPreferences.userId, userId)));
        const categories = mergeCategories(existing, patch.categories);
        for (const category of NOTIFICATION_CATEGORIES) {
          if (patch.categories?.[category] === undefined) continue;
          await tx
            .insert(notificationPreferences)
            .values({ organizationId, userId, category, enabled: categories[category], updatedAt: new Date() })
            .onConflictDoUpdate({
              target: [notificationPreferences.organizationId, notificationPreferences.userId, notificationPreferences.category],
              set: { enabled: categories[category], updatedAt: new Date() },
            });
        }
        const saved = { delivery: NOTIFICATION_DELIVERY, channels: [] as [], categories };
        if (audit) {
          await insertAudit(tx, {
            organizationId,
            actorUserId: audit.draft.actorUserId,
            action: audit.draft.action,
            resourceType: audit.draft.resourceType,
            resourceId: userId,
            metadata: { categories: saved.categories, delivery: saved.delivery },
          });
        }
        return saved;
      });
    },
  };
}
