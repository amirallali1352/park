import { createHash } from "node:crypto";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function calculateHash(event) {
  return createHash("sha256").update(canonical({
    id: event.id, tenantId: event.tenantId, actorId: event.actorId,
    action: event.action, resourceType: event.resourceType, resourceId: event.resourceId,
    payload: event.payload, occurredAt: event.occurredAt, previousHash: event.previousHash
  })).digest("hex");
}

export class AuditError extends Error {
  constructor(message, code = "INVALID_AUDIT_EVENT") {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

export function createAuditEvent({
  id, tenantId, actorId, action, resourceType, resourceId, payload,
  occurredAt = new Date().toISOString(), previousHash = null
}) {
  if (!id || !tenantId || !actorId || !action || !resourceType || !resourceId ||
      payload === undefined) throw new AuditError("Audit event fields are required.");
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) throw new AuditError("Audit timestamp is invalid.");
  const event = {
    id, tenantId, actorId, action, resourceType, resourceId,
    payload, occurredAt: date.toISOString(), previousHash
  };
  return Object.freeze({ ...event, hash: calculateHash(event) });
}

export function verifyAuditChain(events) {
  let previousHash = null;
  for (const event of events) {
    if (event.previousHash !== previousHash || event.hash !== calculateHash(event)) return false;
    previousHash = event.hash;
  }
  return true;
}
