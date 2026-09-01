# Finance و Escrow

هسته‌ی Finance اکنون چرخه‌ی پایه‌ی پرداخت را پشتیبانی می‌کند:

1. ایجاد Escrow در وضعیت `locked`
2. تأیید در وضعیت `approved`
3. آزادسازی مبلغ در وضعیت `released`

آزادسازی پیش از تأیید یا آزادسازی دوباره مجاز نیست. هر Escrow به Tenant، پرداخت‌کننده،
دریافت‌کننده، ارز، مبلغ و شناسه‌ی مرجع متصل است.

APIها:

- `POST /api/v1/finance/escrows`
- `GET /api/v1/finance/escrows`
- `POST /api/v1/finance/escrows/:id/approve`
- `POST /api/v1/finance/escrows/:id/release`

ایجاد، تأیید و آزادسازی در Audit Trail ثبت می‌شود. migration
`db/011_escrow_transactions.sql` جدول مالی را با RLS و FORCE RLS ایجاد می‌کند.

این مرحله Ledger داخلی و State Machine است و به‌تنهایی انتقال بانکی واقعی انجام
نمی‌دهد. اتصال به PSP، حساب امانی بانکی و تطبیق پرداخت باید در Provider مالی جداگانه
و پس از بررسی الزامات حقوقی و مالیاتی انجام شود.
