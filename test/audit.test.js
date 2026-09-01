import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent, verifyAuditChain } from "../src/security/audit.js";

test("links audit events with SHA-256 hashes", () => {
  const first = createAuditEvent({
    id: "audit-1",
    tenantId: "park-1",
    actorId: "u-1",
    action: "booking.created",
    resourceType: "booking",
    resourceId: "b-1",
    payload: { equipmentId: "eq-1" }
  });
  const second = createAuditEvent({
    id: "audit-2",
    tenantId: "park-1",
    actorId: "u-1",
    action: "booking.confirmed",
    resourceType: "booking",
    resourceId: "b-1",
    payload: { bookingId: "b-1" },
    previousHash: first.hash
  });

  assert.equal(first.previousHash, null);
  assert.equal(first.hash.length, 64);
  assert.equal(second.previousHash, first.hash);
  assert.equal(verifyAuditChain([first, second]), true);
});

test("detects tampering in an audit chain", () => {
  const first = createAuditEvent({
    id: "audit-1", tenantId: "park-1", actorId: "u-1",
    action: "sample.received", resourceType: "sample", resourceId: "s-1", payload: {}
  });
  const second = createAuditEvent({
    id: "audit-2", tenantId: "park-1", actorId: "u-1",
    action: "sample.stored", resourceType: "sample", resourceId: "s-1", payload: {},
    previousHash: first.hash
  });
  const tampered = { ...second, payload: { changed: true } };
  assert.equal(verifyAuditChain([first, tampered]), false);
});

test("rejects invalid audit fields", () => {
  assert.throws(
    () => createAuditEvent({
      id: "audit-1", tenantId: "park-1", actorId: "u-1",
      action: "", resourceType: "sample", resourceId: "s-1", payload: {}
    }),
    { code: "INVALID_AUDIT_EVENT" }
  );
});
