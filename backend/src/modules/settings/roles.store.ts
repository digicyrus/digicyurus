import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { permissions, rolePermissions, roles, users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { isRoleKey, ROLE_KEYS } from "../auth/permissions.js";
import { assertRolePermissionChange, resolvePermissionKeys } from "./guards.js";

export type RoleRecord = {
  id: string;
  key: string;
  name: string;
  system: boolean;
  permissions: string[];
};

export type RoleStore = {
  list(): Promise<RoleRecord[]>;
  find(id: string): Promise<RoleRecord | null>;
  replacePermissions(
    organizationId: string,
    roleId: string,
    actorRoleKey: string,
    requested: readonly string[],
    audit?: AuditRequest | null,
  ): Promise<RoleRecord | null>;
};

type Executor = Pick<Database["db"], "select">;

async function permissionKeys(tx: Executor, roleId: string): Promise<string[]> {
  const rows = await tx
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.key).sort();
}

function asRole(row: { id: string; key: string; name: string }, granted: string[]): RoleRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    system: isRoleKey(row.key),
    permissions: [...granted].sort(),
  };
}

export function createDrizzleRoleStore(database: Database): RoleStore {
  const { db } = database;
  return {
    async list() {
      const rows = await db.select().from(roles);
      const granted = await Promise.all(rows.map(async (row) => [row.id, await permissionKeys(db, row.id)] as const));
      const byId = new Map(granted);
      return rows
        .map((row) => asRole(row, byId.get(row.id) ?? []))
        .sort((left, right) => roleOrder(left.key) - roleOrder(right.key) || left.key.localeCompare(right.key));
    },
    async find(id) {
      const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
      if (!row) return null;
      return asRole(row, await permissionKeys(db, row.id));
    },
    async replacePermissions(organizationId, roleId, actorRoleKey, requested, audit) {
      return db.transaction(async (tx) => {
        const [role] = await tx.select().from(roles).where(eq(roles.id, roleId)).limit(1).for("update");
        if (!role) return null;
        const catalog = await tx.select({ id: permissions.id, key: permissions.key }).from(permissions);
        const resolved = resolvePermissionKeys(requested, catalog);
        const [superRole] = await tx.select().from(roles).where(eq(roles.key, "super_admin")).limit(1);
        const superAdminPermissions = superRole ? await permissionKeys(tx, superRole.id) : [];
        const [count] = await tx
          .select({ value: sql<number>`cast(count(*) as int)` })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(and(eq(users.organizationId, organizationId), eq(roles.key, "super_admin"), eq(users.status, "active")));
        assertRolePermissionChange({
          actorRoleKey,
          targetRoleKey: role.key,
          permissions: resolved,
          activeSuperAdminCount: Number(count?.value ?? 0),
          superAdminPermissions,
        });
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
        if (resolved.length > 0) {
          const idByKey = new Map(catalog.map((item) => [item.key, item.id]));
          await tx.insert(rolePermissions).values(resolved.map((key) => {
            const permissionId = idByKey.get(key);
            if (!permissionId) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { permissions: "Unknown permission" });
            return { roleId: role.id, permissionId };
          }));
        }
        const saved = asRole(role, resolved);
        if (audit) {
          await insertAudit(tx, {
            organizationId,
            actorUserId: audit.draft.actorUserId,
            action: audit.draft.action,
            resourceType: audit.draft.resourceType,
            resourceId: role.id,
            metadata: { roleKey: saved.key, permissions: saved.permissions },
          });
        }
        return saved;
      });
    },
  };
}

function roleOrder(key: string): number {
  const index = (ROLE_KEYS as readonly string[]).indexOf(key);
  return index === -1 ? ROLE_KEYS.length : index;
}
