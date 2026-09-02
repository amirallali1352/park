function mapSubscription(row) {
  return {
    id: row.id, tenantId: row.tenant_id, planCode: row.plan_code,
    currency: row.currency.trim(), amount: Number(row.amount), status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapInvoice(row) {
  return {
    id: row.id, tenantId: row.tenant_id, subscriptionId: row.subscription_id,
    amount: Number(row.amount), currency: row.currency.trim(), status: row.status,
    provider: row.provider, paymentId: row.payment_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export class PostgresBillingRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async #withTenantContext(tenantId, work) {
    if (typeof this.pool.connect !== "function") {
      await this.pool.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return work(this.pool);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveSubscription(subscription) {
    const result = await this.#withTenantContext(subscription.tenantId, (client) => client.query(
      `INSERT INTO subscriptions
       (id, tenant_id, plan_code, currency, amount, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, id) DO UPDATE SET
       plan_code=EXCLUDED.plan_code, currency=EXCLUDED.currency,
       amount=EXCLUDED.amount, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at
       RETURNING *`,
      [subscription.id, subscription.tenantId, subscription.planCode, subscription.currency,
        subscription.amount, subscription.status, subscription.createdAt, subscription.updatedAt]
    ));
    return mapSubscription(result.rows[0]);
  }

  async findSubscription(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM subscriptions WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  async listSubscriptions(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]
    ));
    return result.rows.map(mapSubscription);
  }

  async saveInvoice(invoice) {
    const result = await this.#withTenantContext(invoice.tenantId, (client) => client.query(
      `INSERT INTO billing_invoices
       (id, tenant_id, subscription_id, amount, currency, status, provider, payment_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id, id) DO UPDATE SET
       status=EXCLUDED.status, provider=EXCLUDED.provider,
       payment_id=EXCLUDED.payment_id, updated_at=EXCLUDED.updated_at
       RETURNING *`,
      [invoice.id, invoice.tenantId, invoice.subscriptionId, invoice.amount, invoice.currency,
        invoice.status, invoice.provider, invoice.paymentId, invoice.createdAt, invoice.updatedAt]
    ));
    return mapInvoice(result.rows[0]);
  }

  async findInvoice(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM billing_invoices WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapInvoice(result.rows[0]) : null;
  }

  async listInvoices(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM billing_invoices WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]
    ));
    return result.rows.map(mapInvoice);
  }
}
