import assert from "node:assert/strict";
import test from "node:test";
import {
  VoucherStatus,
  applyVoucher,
  createVoucher
} from "../src/domain/voucher.js";

test("creates and applies a government R&D voucher to an escrow", () => {
  let voucher = createVoucher({
    id: "voucher-1", tenantId: "park-1", beneficiaryId: "startup-1",
    program: "TÜBİTAK", currency: "TRY", amount: 3000
  });
  assert.equal(voucher.status, VoucherStatus.ACTIVE);
  const result = applyVoucher(voucher, {
    escrowId: "escrow-1", amount: 2500, actorId: "park-1"
  });
  assert.equal(result.voucher.status, VoucherStatus.REDEEMED);
  assert.equal(result.appliedAmount, 2500);
  assert.equal(result.remainingAmount, 500);
});

test("rejects over-redemption and reuse", () => {
  const voucher = createVoucher({
    id: "voucher-2", tenantId: "park-1", beneficiaryId: "startup-1",
    program: "EU", currency: "EUR", amount: 100
  });
  assert.throws(() => applyVoucher(voucher, {
    escrowId: "e-1", amount: 101, actorId: "park-1"
  }), { code: "VOUCHER_AMOUNT_EXCEEDED" });
  const applied = applyVoucher(voucher, { escrowId: "e-1", amount: 100, actorId: "park-1" });
  assert.throws(() => applyVoucher(applied.voucher, {
    escrowId: "e-2", amount: 1, actorId: "park-1"
  }), { code: "VOUCHER_EXHAUSTED" });
});
