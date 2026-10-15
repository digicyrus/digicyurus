import { AppError } from "../../lib/errors.js";
import { ALL_PERMISSIONS, type PermissionKey } from "../auth/permissions.js";
import { ESCALATION_PERMISSIONS } from "./constants.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export function resolvePermissionKeys(
  requested: readonly string[],
  catalog: readonly { id: string; key: string }[],
): PermissionKey[] {
  const byId = new Map(catalog.map((item) => [item.id, item.key]));
  const byKey = new Map(catalog.map((item) => [item.key, item.key]));
  const resolved: PermissionKey[] = [];
  const seen = new Set<string>();
  for (const value of requested) {
    const raw = value.trim();
    const key = UUID_PATTERN.test(raw) ? byId.get(raw) : byKey.get(raw);
    if (!key || !isPermissionKey(key)) {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { permissions: "Unknown permission" });
    }
    if (seen.has(key)) {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { permissions: "Duplicate permission" });
    }
    seen.add(key);
    resolved.push(key);
  }
  return resolved;
}

export function assertRolePermissionChange(input: {
  actorRoleKey: string;
  targetRoleKey: string;
  permissions: readonly string[];
  activeSuperAdminCount: number;
  superAdminPermissions: readonly string[];
}): void {
  if (input.actorRoleKey !== "super_admin") {
    throw new AppError(403, "FORBIDDEN", "Only a Super Admin can perform this action");
  }
  if (input.targetRoleKey === "super_admin" || input.actorRoleKey === input.targetRoleKey) {
    throw new AppError(409, "CONFLICT", "The Super Admin role cannot be changed");
  }
  if (input.activeSuperAdminCount < 1 || !input.superAdminPermissions.includes("roles:update") || !input.superAdminPermissions.includes("settings:update")) {
    throw new AppError(409, "CONFLICT", "Super Admin access must remain");
  }
  if (input.permissions.some((permission) => (ESCALATION_PERMISSIONS as readonly string[]).includes(permission))) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      permissions: "This permission cannot be granted to this role",
    });
  }
}
