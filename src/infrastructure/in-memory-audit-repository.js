import { AuditError, createAuditEvent } from "../security/audit.js";

export class InMemoryAuditRepository {
  #events = new Map();

  async append(event) {
    const latest = (await this.list(event.tenantId)).at(-1);
    const normalized = latest && event.previousHash !== latest.hash
      ? createAuditEvent({ ...event, previousHash: latest.hash }) : event;
    this.#events.set(normalized.id, normalized);
    return normalized;
  }

  async latestHash(tenantId) {
    return (await this.list(tenantId)).at(-1)?.hash ?? null;
  }

  async list(tenantId) {
    return [...this.#events.values()]
      .filter((event) => event.tenantId === tenantId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  async update() { throw new AuditError("Audit trail is append-only.", "AUDIT_APPEND_ONLY"); }
  async remove() { throw new AuditError("Audit trail is append-only.", "AUDIT_APPEND_ONLY"); }
}
