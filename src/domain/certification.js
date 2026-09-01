export class CertificationError extends Error {
  constructor(message, code = "INVALID_CERTIFICATION") {
    super(message);
    this.name = "CertificationError";
    this.code = code;
  }
}

export function createCertification({ id, tenantId, equipmentId, userId, expiresAt } = {}) {
  if (!id || !tenantId || !equipmentId || !userId || !expiresAt) {
    throw new CertificationError("Certification fields are required.");
  }
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
    throw new CertificationError("Certification expiry must be in the future.", "INVALID_CERTIFICATION_EXPIRY");
  }
  const now = new Date().toISOString();
  return Object.freeze({
    id, tenantId, equipmentId, userId,
    expiresAt: expiry.toISOString(), createdAt: now
  });
}

export function isCertificationValid(certification, at = new Date()) {
  return Boolean(certification && new Date(certification.expiresAt) > new Date(at));
}
