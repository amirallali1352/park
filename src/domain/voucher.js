export const VoucherStatus = Object.freeze({ ACTIVE: "active", REDEEMED: "redeemed" });

export class VoucherError extends Error {
  constructor(message, code = "VOUCHER_ERROR") {
    super(message);
    this.name = "VoucherError";
    this.code = code;
  }
}

export function createVoucher({
  id, tenantId, beneficiaryId, program, currency, amount
} = {}) {
  if (!id || !tenantId || !beneficiaryId || !program || !currency ||
      !Number.isFinite(amount) || amount <= 0) {
    throw new VoucherError("Valid voucher fields are required.", "INVALID_VOUCHER");
  }
  const now = new Date().toISOString();
  return Object.freeze({
    id, tenantId, beneficiaryId, program, currency, amount,
    redeemedAmount: 0, status: VoucherStatus.ACTIVE,
    createdAt: now, updatedAt: now
  });
}

export function applyVoucher(voucher, { escrowId, amount, actorId } = {}) {
  if (!voucher || !escrowId || !actorId || !Number.isFinite(amount) || amount <= 0) {
    throw new VoucherError("A valid escrow, actor and amount are required.", "INVALID_VOUCHER_REDEMPTION");
  }
  if (voucher.status === VoucherStatus.REDEEMED) {
    throw new VoucherError("Voucher has already been redeemed.", "VOUCHER_EXHAUSTED");
  }
  if (amount > voucher.amount - voucher.redeemedAmount) {
    throw new VoucherError("Voucher amount exceeded.", "VOUCHER_AMOUNT_EXCEEDED");
  }
  const now = new Date().toISOString();
  const redeemedAmount = voucher.redeemedAmount + amount;
  return {
    voucher: Object.freeze({
      ...voucher, redeemedAmount, status: VoucherStatus.REDEEMED, updatedAt: now
    }),
    escrowId,
    appliedAmount: amount,
    remainingAmount: voucher.amount - redeemedAmount
  };
}
