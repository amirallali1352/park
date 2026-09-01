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

  async snapshot(tenantId) {
    if (typeof this.client.query !== "function") {
      throw new TypeError("A ClickHouse client with query is required for snapshots.");
    }
    const result = await this.client.query({
      query: `
        SELECT
          countIf(event_type = 'BookingConfirmed') AS booking_count,
          sum(utilization_minutes) AS utilization_minutes,
          sum(rd_spend) AS rd_spend,
          sum(economic_output) AS economic_output
        FROM (
          SELECT
            event_id,
            any(event_type) AS event_type,
            any(payload) AS payload,
            if(event_type = 'BookingConfirmed',
              JSONExtractFloat(any(payload), 'durationMinutes'), 0) AS utilization_minutes,
            if(event_type = 'PaymentSettled' AND
              JSONExtractString(any(payload), 'category') = 'rd',
              JSONExtractFloat(any(payload), 'amount'), 0) AS rd_spend,
            if(event_type = 'BookingConfirmed',
              JSONExtractFloat(any(payload), 'amount'), 0) AS economic_output
          FROM {table:Identifier}
          WHERE tenant_id = {tenantId:String}
          GROUP BY event_id
        )
      `.replace("{table:Identifier}", "`" + this.table.replaceAll("`", "") + "`"),
      query_params: { tenantId },
      format: "JSONEachRow"
    });
    const row = (await result.json())[0] ?? {};
    return {
      tenantId,
      bookingCount: Number(row.booking_count ?? 0),
      utilizationMinutes: Number(row.utilization_minutes ?? 0),
      rdSpend: Number(row.rd_spend ?? 0),
      economicOutput: Number(row.economic_output ?? 0)
    };
  }
}
