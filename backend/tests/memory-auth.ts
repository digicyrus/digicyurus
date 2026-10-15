import type { AuthUser, AuthStore } from "../src/modules/auth/auth.store.js";
import type { PasswordVerifier } from "../src/modules/auth/auth.routes.js";

export function createMemoryAuthStore(): AuthStore & {
  users: AuthUser[];
  sessions: { userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }[];
} {
  const users: AuthUser[] = [];
  const sessions: { userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }[] = [];
  return {
    users,
    sessions,
    async findUserByEmail(email) {
      return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async findSessionByTokenHash(tokenHash) {
      const session = sessions.find((item) => item.tokenHash === tokenHash);
      if (!session) return null;
      const user = users.find((item) => item.id === session.userId);
      if (!user) return null;
      return { tokenHash: session.tokenHash, expiresAt: session.expiresAt, revokedAt: session.revokedAt, user };
    },
    async insertSession(input, audit) {
      sessions.push({ ...input, revokedAt: null });
      if (!audit?.persist) return;
      try {
        await audit.persist({
          organizationId: audit.organizationId,
          actorUserId: audit.draft.actorUserId,
          action: audit.draft.action,
          resourceType: audit.draft.resourceType,
          resourceId: input.userId,
          metadata: audit.draft.metadata ?? {},
        });
      } catch (error) {
        sessions.pop();
        throw error;
      }
    },
    async revokeSession(tokenHash, audit) {
      const session = sessions.find((item) => item.tokenHash === tokenHash && item.revokedAt === null);
      if (!session) return;
      const previous = session.revokedAt;
      session.revokedAt = new Date();
      if (!audit?.persist) return;
      const user = users.find((item) => item.id === session.userId);
      if (!user) return;
      try {
        await audit.persist({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "logout",
          resourceType: "user",
          resourceId: user.id,
          metadata: {},
        });
      } catch (error) {
        session.revokedAt = previous;
        throw error;
      }
    },
  };
}

export function createFakeVerifier(): PasswordVerifier & { calls: { hash: string; password: string }[] } {
  const calls: { hash: string; password: string }[] = [];
  return {
    calls,
    async hash(password) {
      return `fake:${password}`;
    },
    async verify(passwordHash, password) {
      calls.push({ hash: passwordHash, password });
      return passwordHash === `fake:${password}`;
    },
    async dummyHash() {
      return "fake:dummy";
    },
  };
}

export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    organizationId: "org-1",
    name: "Ada Admin",
    email: "ada@digicyrus.example",
    roleKey: "super_admin",
    roleName: "Super Admin",
    status: "active",
    passwordHash: "fake:correct-password",
    permissions: ["dashboard:view"],
    ...overrides,
  };
}
