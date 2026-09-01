import assert from "node:assert/strict";
import test from "node:test";
import {
  EscrowStatus,
  createEscrow,
  releaseEscrow,
  approveEscrow
} from "../src/domain/finance.js";

test("creates, approves, and releases an escrow payment", () => {
  let escrow = createEscrow({
    id: "escrow-1", tenantId: "park-1", payerId: "startup-1",
    payeeId: "lab-1", currency: "TRY", amount: 12500, referenceId: "booking-1"
  });
  assert.equal(escrow.status, EscrowStatus.LOCKED);
  escrow = approveEscrow(escrow, { actorId: "park-1" });
  assert.equal(escrow.status, EscrowStatus.APPROVED);
  escrow = releaseEscrow(escrow, { actorId: "park-1" });
  assert.equal(escrow.status, EscrowStatus.RELEASED);
  assert.equal(escrow.amount, 12500);
});

test("rejects invalid amounts and duplicate release", () => {
  assert.throws(() => createEscrow({
    id: "bad", tenantId: "park-1", payerId: "a", payeeId: "b",
    currency: "TRY", amount: 0, referenceId: "x"
  }), { code: "INVALID_ESCROW" });
  const escrow = createEscrow({
    id: "escrow-2", tenantId: "park-1", payerId: "a", payeeId: "b",
    currency: "EUR", amount: 10, referenceId: "x"
  });
  assert.throws(() => releaseEscrow(escrow, { actorId: "park-1" }), {
    code: "ESCROW_NOT_APPROVED"
  });
  assert.throws(() => releaseEscrow({ ...escrow, status: "released" }, { actorId: "park-1" }), {
    code: "ESCROW_ALREADY_RELEASED"
  });
});
