import { randomUUID } from "node:crypto";

import type { AuditRequest } from "../src/modules/audit/types.js";
import { ALL_PERMISSIONS, isRoleKey, permissionsForRole, ROLE_KEYS, ROLE_NAMES } from "../src/modules/auth/permissions.js";
import type { UpdateCompanyBody } from "../src/modules/settings/company.schema.js";
import type { CompanyRecord, CompanyStore } from "../src/modules/settings/company.store.js";
import { assertRolePermissionChange, resolvePermissionKeys } from "../src/modules/settings/guards.js";
import { mergeCategories } from "../src/modules/settings/notifications.store.js";
import type { NotificationPreferenceRecord, NotificationStore } from "../src/modules/settings/notifications.store.js";
import type { UpdateNotificationBody } from "../src/modules/settings/notifications.schema.js";
import { NOTIFICATION_CATEGORIES } from "../src/modules/settings/constants.js";
import type { RoleRecord, RoleStore } from "../src/modules/settings/roles.store.js";

export const INVOICES_VIEW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

async function persistAudit(
  audit: AuditRequest | null | undefined,
  resourceId: string | null,
  metadata: Record<string, unknown>,
  rollback: () => void,
): Promise<void> {
  if (!audit?.persist) return;
  try {
    await audit.persist({
      organizationId: audit.organizationId,
      actorUserId: audit.draft.actorUserId,
      action: audit.draft.action,
      resourceType: audit.draft.resourceType,
      resourceId,
      metadata,
    });
  } catch (error) {
    rollback();
    throw error;
  }
}

export function blankCompany(id: string): CompanyRecord {
  return {
    id,
    legalName: "DigiCyrus Technologies Pvt Ltd",
    brandName: "DigiCyrus",
    gstin: null,
    billingEmail: null,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

export function createMemoryCompanyStore(): CompanyStore & { records: CompanyRecord[] } {
  const records: CompanyRecord[] = [];
  return {
    records,
    async find(organizationId) {
      return records.find((record) => record.id === organizationId) ?? null;
    },
    async update(organizationId, patch: UpdateCompanyBody, audit) {
      const current = records.find((record) => record.id === organizationId);
      if (!current) return null;
      const previous = { ...current };
      Object.assign(current, patch, { updatedAt: new Date() });
      await persistAudit(audit, organizationId, audit?.draft.metadata ?? {}, () => Object.assign(current, previous));
      return { ...current };
    },
  };
}

export function createMemoryRoleStore(): RoleStore & {
  records: RoleRecord[];
  catalog: { id: string; key: string }[];
  members: { organizationId: string; roleKey: string; status: "active" | "disabled" }[];
} {
  const catalog = ALL_PERMISSIONS.map((key) => ({
    id: key === "invoices:view" ? INVOICES_VIEW_ID : randomUUID(),
    key,
  }));
  const records: RoleRecord[] = ROLE_KEYS.map((key) => ({
    id: randomUUID(),
    key,
    name: ROLE_NAMES[key],
    system: isRoleKey(key),
    permissions: [...permissionsForRole(key)],
  }));
  const members: { organizationId: string; roleKey: string; status: "active" | "disabled" }[] = [
    { organizationId: "org-1", roleKey: "super_admin", status: "active" },
  ];
  return {
    records,
    catalog,
    members,
    async list() {
      return records
        .map((role) => ({ ...role, permissions: [...role.permissions].sort() }))
        .sort((left, right) => ROLE_KEYS.indexOf(left.key as (typeof ROLE_KEYS)[number]) - ROLE_KEYS.indexOf(right.key as (typeof ROLE_KEYS)[number]));
    },
    async find(id) {
      const role = records.find((item) => item.id === id);
      return role ? { ...role, permissions: [...role.permissions].sort() } : null;
    },
    async replacePermissions(organizationId, roleId, actorRoleKey, requested, audit) {
      const role = records.find((item) => item.id === roleId);
      if (!role) return null;
      const resolved = resolvePermissionKeys(requested, catalog);
      const superRole = records.find((item) => item.key === "super_admin");
      assertRolePermissionChange({
        actorRoleKey,
        targetRoleKey: role.key,
        permissions: resolved,
        activeSuperAdminCount: members.filter((member) => member.organizationId === organizationId && member.roleKey === "super_admin" && member.status === "active").length,
        superAdminPermissions: superRole?.permissions ?? [],
      });
      const previous = [...role.permissions];
      role.permissions = [...resolved].sort();
      await persistAudit(audit, role.id, { roleKey: role.key, permissions: role.permissions }, () => {
        role.permissions = previous;
      });
      return { ...role, permissions: [...role.permissions] };
    },
  };
}

export function createMemoryNotificationStore(): NotificationStore & {
  users: { id: string; organizationId: string }[];
  rows: { organizationId: string; userId: string; category: string; enabled: boolean }[];
} {
  const users: { id: string; organizationId: string }[] = [];
  const rows: { organizationId: string; userId: string; category: string; enabled: boolean }[] = [];
  function known(organizationId: string, userId: string): boolean {
    return users.some((user) => user.id === userId && user.organizationId === organizationId);
  }
  function saved(organizationId: string, userId: string, categories = mergeCategories(rows.filter((row) => row.organizationId === organizationId && row.userId === userId))): NotificationPreferenceRecord {
    return { delivery: "unavailable", channels: [], categories };
  }
  return {
    users,
    rows,
    async get(organizationId, userId) {
      if (!known(organizationId, userId)) return null;
      return saved(organizationId, userId);
    },
    async update(organizationId, userId, patch: UpdateNotificationBody, audit) {
      if (!known(organizationId, userId)) return null;
      const previous = rows.map((row) => ({ ...row }));
      const categories = mergeCategories(rows.filter((row) => row.organizationId === organizationId && row.userId === userId), patch.categories);
      for (const category of NOTIFICATION_CATEGORIES) {
        if (patch.categories?.[category] === undefined) continue;
        const current = rows.find((row) => row.organizationId === organizationId && row.userId === userId && row.category === category);
        if (current) current.enabled = categories[category];
        else rows.push({ organizationId, userId, category, enabled: categories[category] });
      }
      const record = saved(organizationId, userId, categories);
      await persistAudit(audit, userId, { categories: record.categories, delivery: record.delivery }, () => {
        rows.splice(0, rows.length, ...previous);
      });
      return record;
    },
  };
}
