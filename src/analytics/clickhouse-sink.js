export class ClickHouseAnalyticsSink {
  constructor({ client, table = "stp_events" } = {}) {
    if (!client || typeof client.insert !== "function") {
      throw new TypeError("A ClickHouse client with insert is required.");
    }
    this.client = client;
    this.table = table;
  }

  async write(event) {
    await this.client.insert({
      table: this.table,
      values: [{
        event_id: event.id,
        event_type: event.type,
        tenant_id: event.tenantId,
        occurred_at: event.occurredAt ?? new Date().toISOString(),
        payload: JSON.stringify(event.payload ?? {})
      }],
      format: "JSONEachRow"
    });
  }
}
