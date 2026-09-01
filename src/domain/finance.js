export const EscrowStatus = Object.freeze({
  LOCKED: "locked",
  APPROVED: "approved",
  RELEASED: "released"
});

export class FinanceError extends Error {
  constructor(message, code = "FINANCE_ERROR") {
    super(message);
    this.name = "FinanceError";
    this.code = code;
  }
}

function timestamp() {
  return new Date().toISOString();
}

export function createEscrow({
  id, tenantId, payerId, payeeId, currency, amount, referenceId
} = {}) {
  if (!id || !tenantId || !payerId || !payeeId || payerId === payeeId ||
      !currency || !Number.isFinite(amount) || amount <= 0 || !referenceId) {
    throw new FinanceError("Valid escrow parties, currency, amount and reference are required.", "INVALID_ESCROW");
  }
  const now = timestamp();
  return Object.freeze({
    id, tenantId, payerId, payeeId, currency, amount, referenceId,
    status: EscrowStatus.LOCKED, createdAt: now, updatedAt: now
  });
}

export function approveEscrow(escrow, { actorId } = {}) {
  if (!actorId || escrow.status !== EscrowStatus.LOCKED) {
    throw new FinanceError("Only a locked escrow can be approved.", "ESCROW_NOT_LOCKED");
  }
  return Object.freeze({ ...escrow, status: EscrowStatus.APPROVED, updatedAt: timestamp() });
}

export function releaseEscrow(escrow, { actorId } = {}) {
  if (escrow.status === EscrowStatus.RELEASED) {
    throw new FinanceError("Escrow was already released.", "ESCROW_ALREADY_RELEASED");
  }
  if (!actorId || escrow.status !== EscrowStatus.APPROVED) {
    throw new FinanceError("Escrow must be approved before release.", "ESCROW_NOT_APPROVED");
  }
  return Object.freeze({ ...escrow, status: EscrowStatus.RELEASED, updatedAt: timestamp() });
}
