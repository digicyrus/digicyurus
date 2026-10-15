import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { permissions, rolePermissions, roles, sessions, users } from "../../db/schema/index.js";
import { auditEvent, insertAudit } from "../audit/write.js";
import type { AuditRequest } from "../audit/types.js";

export type AuthUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  status: "active" | "disabled";
  passwordHash: string;
  permissions: string[];
};

export type AuthSession = {
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
};

export type AuthStore = {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  insertSession(input: { userId: string; tokenHash: string; expiresAt: Date }, audit?: AuditRequest | null): Promise<void>;
  revokeSession(tokenHash: string, audit?: Pick<AuditRequest, "persist"> | null): Promise<void>;
};

function asStatus(value: string): "active" | "disabled" {
  return value === "disabled" ? "disabled" : "active";
}

async function loadPermissions(db: Database["db"], roleId: string): Promise<string[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.key).sort();
}

async function loadUser(db: Database["db"], where: SQL): Promise<AuthUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      name: users.name,
      email: users.email,
      status: users.status,
      passwordHash: users.passwordHash,
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where)
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    email: row.email,
    roleKey: row.roleKey,
    roleName: row.roleName,
    status: asStatus(row.status),
    passwordHash: row.passwordHash,
    permissions: await loadPermissions(db, row.roleId),
  };
}

export function createDrizzleAuthStore(database: Database): AuthStore {
  const { db } = database;
  return {
    findUserByEmail(email) {
      return loadUser(db, sql`lower(${users.email}) = ${email.toLowerCase()}`);
    },
    async findSessionByTokenHash(tokenHash) {
      const [row] = await db
        .select({
          tokenHash: sessions.tokenHash,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
          userId: sessions.userId,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      if (!row) return null;
      const user = await loadUser(db, eq(users.id, row.userId));
      if (!user) return null;
      return { tokenHash: row.tokenHash, expiresAt: row.expiresAt, revokedAt: row.revokedAt, user };
    },
    async insertSession(input, audit) {
      await db.transaction(async (tx) => {
        await tx.insert(sessions).values(input);
        if (audit) {
          await insertAudit(tx, auditEvent({
            organizationId: audit.organizationId,
            draft: audit.draft,
            resourceId: input.userId,
          }));
        }
      });
    },
    async revokeSession(tokenHash, audit) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ userId: sessions.userId, revokedAt: sessions.revokedAt })
          .from(sessions)
          .where(eq(sessions.tokenHash, tokenHash))
          .limit(1);
        if (!row || row.revokedAt) return;
        await tx.update(sessions).set({ revokedAt: sql`now()` }).where(eq(sessions.tokenHash, tokenHash));
        if (!audit) return;
        const user = await loadUser(tx as Database["db"], eq(users.id, row.userId));
        if (!user) return;
        await insertAudit(tx, {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "logout",
          resourceType: "user",
          resourceId: user.id,
          metadata: {},
        });
      });
    },
  };
}
