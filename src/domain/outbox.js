export const DomainEventType = Object.freeze({
  BOOKING_CONFIRMED: "BookingConfirmed",
  SAMPLE_RECEIVED: "SampleReceived",
  MAINTENANCE_SCHEDULED: "MaintenanceScheduled"
});

export class OutboxError extends Error {
  constructor(message, code = "INVALID_DOMAIN_EVENT") {
    super(message);
    this.name = "OutboxError";
    this.code = code;
  }
}

export function createDomainEvent({
  id, tenantId, type, aggregateId, payload, occurredAt = new Date().toISOString(),
  version = 1, status = "pending"
}) {
  if (!id || !tenantId || !Object.values(DomainEventType).includes(type) ||
      !aggregateId || payload === undefined) {
    throw new OutboxError("Event fields and a supported type are required.");
  }
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) throw new OutboxError("Event timestamp is invalid.");
  return Object.freeze({
    id, tenantId, type, version, aggregateId, payload,
    occurredAt: date.toISOString(), status
  });
}
