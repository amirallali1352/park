export class AnalyticsAggregator {
  #tenants = new Map();
  #processed = new Set();

  consume(event) {
    if (!event?.tenantId || !event?.type) return;
    const key = event.id ?? `${event.type}:${event.tenantId}:${JSON.stringify(event.payload ?? {})}`;
    if (this.#processed.has(key)) return;
    this.#processed.add(key);
    const current = this.#tenants.get(event.tenantId) ?? {
      tenantId: event.tenantId,
      bookingCount: 0,
      utilizationMinutes: 0,
      rdSpend: 0,
      economicOutput: 0
    };
    const payload = event.payload ?? {};
    if (event.type === "BookingConfirmed") {
      current.bookingCount += 1;
      current.utilizationMinutes += Number(payload.durationMinutes ?? 0);
      current.economicOutput += Number(payload.amount ?? 0);
    }
    if (event.type === "PaymentSettled" && payload.category === "rd") {
      current.rdSpend += Number(payload.amount ?? 0);
    }
    this.#tenants.set(event.tenantId, current);
  }

  snapshot(tenantId) {
    return this.#tenants.get(tenantId) ?? {
      tenantId, bookingCount: 0, utilizationMinutes: 0, rdSpend: 0, economicOutput: 0
    };
  }
}
