export const TenantType = Object.freeze({
  PARK: "park",
  STARTUP: "startup",
  ACADEMIC: "academic"
});

export const UserRole = Object.freeze({
  PARK_ADMIN: "park_admin",
  TENANT_ADMIN: "tenant_admin",
  MEMBER: "member"
});

export class IdentityError extends Error {
  constructor(message, code = "IDENTITY_ERROR") {
    super(message);
    this.name = "IdentityError";
    this.code = code;
  }
}

export function createTenant({ id, name, type }) {
  if (!id || !name || !Object.values(TenantType).includes(type)) {
    throw new IdentityError("Tenant id, name and a valid type are required.", "INVALID_TENANT");
  }
  return Object.freeze({ id, name, type });
}

export function createUser({ id, tenantId, email, role = UserRole.MEMBER }) {
  if (!id || !tenantId || !email || !Object.values(UserRole).includes(role)) {
    throw new IdentityError("User id, tenantId, email and a valid role are required.", "INVALID_USER");
  }
  return Object.freeze({ id, tenantId, email: email.toLowerCase(), role });
}

export function canAccessTenant(user, tenantId) {
  return Boolean(user && tenantId && user.tenantId === tenantId);
}

export function assertTenantAccess(user, tenantId) {
  if (!canAccessTenant(user, tenantId)) {
    throw new IdentityError("Cross-tenant access denied.", "TENANT_ACCESS_DENIED");
  }
}
