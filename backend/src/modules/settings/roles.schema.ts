import { z } from "zod";

import { ALL_PERMISSIONS } from "../auth/permissions.js";

export const roleIdParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const replaceRolePermissionsBody = z.object({
  permissions: z.array(z.string().trim().min(1).max(80)).max(ALL_PERMISSIONS.length),
});

export type ReplaceRolePermissionsBody = z.infer<typeof replaceRolePermissionsBody>;
