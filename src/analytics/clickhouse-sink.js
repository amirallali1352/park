export class ClickHouseAnalyticsSink {
  constructor({ client, table = "stp_events" } = {}) {
    if (!client || typeof client.insert !== "function") {
      throw new TypeError("A ClickHouse client with insert is required.");
    }
    this.client = client;
    this.table = table;
  }

  async write(event) {
    const occurredAt = new Date(event.occurredAt ?? Date.now());
    if (Number.isNaN(occurredAt.getTime())) {
      throw new TypeError("Analytics event occurredAt must be a valid date.");
    }
    const clickHouseOccurredAt = occurredAt.toISOString()
      .replace("T", " ")
      .replace("Z", "");
    await this.client.insert({
      table: this.table,
      values: [{
        event_id: event.id,
        event_type: event.type,
        tenant_id: event.tenantId,
        occurred_at: clickHouseOccurredAt,
        payload: JSON.stringify(event.payload ?? {})
      }],
      format: "JSONEachRow"
    });
  }
}
