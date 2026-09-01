# Voucherهای حمایتی R&D

این مرحله Voucherهای دولتی یا سازمانی تحقیق‌وتوسعه را به جریان Escrow متصل می‌کند.
Voucher به یک Tenant تعلق دارد و برای یک ذی‌نفع، برنامه حمایتی، ارز و سقف مبلغ
صادر می‌شود.

## رفتار کسب‌وکار

- Voucher در ابتدا `active` است.
- مصرف فقط در همان Tenant انجام می‌شود.
- ذی‌نفع Voucher باید یکی از طرفین Escrow (`payer` یا `payee`) باشد.
- ارز Voucher باید با ارز Escrow یکسان باشد.
- مقدار مصرف‌شده نمی‌تواند از سقف Voucher بیشتر باشد.
- هر Voucher پس از اولین مصرف، حتی اگر بخشی از سقف آن باقی مانده باشد،
  `redeemed` می‌شود و دوباره قابل مصرف نیست. این تصمیم برای جلوگیری از
  دوباره‌خرج‌کردن و ساده‌سازی تسویه مرحله اول اتخاذ شده است.
- صدور و مصرف Voucher در Audit Trail ثبت می‌شود.

## API

### ایجاد Voucher

`POST /api/v1/finance/vouchers`

```json
{
  "id": "voucher-1",
  "beneficiaryId": "startup-1",
  "program": "TUBITAK",
  "currency": "TRY",
  "amount": 10000
}
```

### فهرست Voucherهای Tenant

`GET /api/v1/finance/vouchers`

### اعمال Voucher روی Escrow

`POST /api/v1/finance/escrows/{escrowId}/apply-voucher`

```json
{
  "voucherId": "voucher-1",
  "amount": 7500
}
```

پاسخ شامل `appliedAmount`، `remainingAmount`، وضعیت جدید Voucher و Escrow
است. این endpoint مبلغ بانکی را جابه‌جا نمی‌کند؛ در این نسخه Voucher به‌عنوان
اعتبار حمایتی ثبت و به تراکنش Escrow متصل می‌شود. اتصال به PSP یا خزانه دولتی
در مرحله Finance Integration انجام خواهد شد.

## پایگاه داده

Migration فایل `db/012_vouchers.sql` جدول `vouchers` را ایجاد می‌کند و RLS و
`FORCE ROW LEVEL SECURITY` را بر اساس `app.tenant_id` فعال می‌کند.
