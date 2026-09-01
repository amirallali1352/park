export const SampleStatus = Object.freeze({
  RECEIVED: "received",
  IN_ANALYSIS: "in_analysis",
  COMPLETED: "completed",
  REJECTED: "rejected"
});

const custodyActions = new Set(["received", "transferred", "stored", "released", "analyzed"]);

export class SampleError extends Error {
  constructor(message, code = "SAMPLE_ERROR") {
    super(message);
    this.name = "SampleError";
    this.code = code;
  }
}

export function createSample({
  id, tenantId, name, barcode, submittedBy, status = SampleStatus.RECEIVED
}) {
  if (!id || !tenantId || !name || !barcode || !submittedBy || !Object.values(SampleStatus).includes(status)) {
    throw new SampleError("Sample fields and a valid status are required.", "INVALID_SAMPLE");
  }
  return Object.freeze({ id, tenantId, name, barcode, submittedBy, status });
}

export function createCustodyEvent({ id, sampleId, tenantId, actorId, action, location, occurredAt = new Date().toISOString() }) {
  if (!id || !sampleId || !tenantId || !actorId || !custodyActions.has(action) || !location) {
    throw new SampleError("Custody event fields are required.", "INVALID_CUSTODY_EVENT");
  }
  const timestamp = new Date(occurredAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new SampleError("Custody event timestamp is invalid.", "INVALID_CUSTODY_EVENT");
  }
  return Object.freeze({
    id, sampleId, tenantId, actorId, action, location, occurredAt: timestamp.toISOString()
  });
}
