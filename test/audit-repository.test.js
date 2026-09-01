import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent } from "../src/security/audit.js";
import { InMemoryAuditRepository } from "../src/infrastructure/in-memory-audit-repository.js";

test("appends audit events using the latest tenant hash", async () => {
  const repository = new InMemoryAuditRepository();
  const first = createAuditEvent({
    id: "audit-1", tenantId: "park-1", actorId: "u-1",
    action: "booking.created", resourceType: "booking", resourceId: "b-1", payload: {}
  });
  const storedFirst = await repository.append(first);
  const second = createAuditEvent({
    id: "audit-2", tenantId: "park-1", actorId: "u-1",
    action: "booking.confirmed", resourceType: "booking", resourceId: "b-1", payload: {},
    previousHash: storedFirst.hash
  });
  await repository.append(second);
  assert.equal((await repository.latestHash("park-1")), second.hash);
  assert.equal((await repository.list("park-1")).length, 2);
});

test("does not allow updates or deletions", async () => {
  const repository = new InMemoryAuditRepository();
  await assert.rejects(() => repository.update("audit-1", {}), { code: "AUDIT_APPEND_ONLY" });
  await assert.rejects(() => repository.remove("audit-1"), { code: "AUDIT_APPEND_ONLY" });
});
