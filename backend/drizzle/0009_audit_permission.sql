-- Grant audit-log reads to super admin. Earlier role grants are unchanged.
INSERT INTO "permissions" ("key") VALUES ('audit_logs:view');
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" = 'audit_logs:view'
WHERE r."key" = 'super_admin';
