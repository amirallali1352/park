import { assertTenantAccess } from "../domain/identity.js";

export class InMemoryIdentityRepository {
  #tenants = new Map();
  #users = new Map();

  saveTenant(tenant) {
    this.#tenants.set(tenant.id, tenant);
    return tenant;
  }

  saveUser(user) {
    if (!this.#tenants.has(user.tenantId)) {
      throw new Error("Cannot create a user for an unknown tenant.");
    }
    this.#users.set(user.id, user);
    return user;
  }

  findUserByEmail(email, tenantId) {
    const normalizedEmail = email?.toLowerCase();
    return [...this.#users.values()].find((user) =>
      user.tenantId === tenantId && user.email === normalizedEmail
    ) ?? null;
  }

  findTenantForUser(user, tenantId) {
    assertTenantAccess(user, tenantId);
    return this.#tenants.get(tenantId) ?? null;
  }

  listUsers(user, tenantId) {
    assertTenantAccess(user, tenantId);
    return [...this.#users.values()].filter((candidate) => candidate.tenantId === tenantId);
  }
}
