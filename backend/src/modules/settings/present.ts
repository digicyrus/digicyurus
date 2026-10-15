import type { CompanyRecord } from "./company.store.js";
import type { NotificationPreferenceRecord } from "./notifications.store.js";
import type { RoleRecord } from "./roles.store.js";

export function presentCompany(record: CompanyRecord) {
  return {
    id: record.id,
    legalName: record.legalName,
    brandName: record.brandName,
    gstin: record.gstin,
    billingEmail: record.billingEmail,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    country: record.country,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentRole(record: RoleRecord) {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    system: record.system,
    permissions: [...record.permissions].sort(),
  };
}

export function presentNotificationPreferences(record: NotificationPreferenceRecord) {
  return {
    delivery: record.delivery,
    channels: record.channels,
    categories: record.categories,
  };
}
