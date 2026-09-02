# Subscription and Billing

The billing module currently provides three plans:

- `academic`
- `startup`
- `enterprise`

Each tenant can create a subscription, issue an invoice, and pay an open
invoice through the configured payment provider.

API routes:

- `POST /api/v1/billing/subscriptions`
- `GET /api/v1/billing/subscriptions`
- `POST /api/v1/billing/invoices`
- `GET /api/v1/billing/invoices`
- `POST /api/v1/billing/invoices/:id/pay`

The provider is selected with `PAYMENT_PROVIDER`. The current `memory`
provider is deterministic and intended for development and Pilot testing. A
real PSP adapter can implement the same `createPayment` and `getPayment`
contract without changing the Billing domain or API.

This implementation does not yet move money through a bank or PSP. Production
activation requires a provider adapter, webhook signature verification,
idempotency keys, reconciliation, refund handling, and legal/financial review.
