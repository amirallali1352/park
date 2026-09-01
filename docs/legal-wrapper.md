# Legal Wrapper

پلتفرم اکنون از دو نوع سند نسخه‌دار پشتیبانی می‌کند:

- `mNDA`: توافق محرمانگی متقابل
- `MSA`: قرارداد اصلی خدمات

چرخه‌ی قرارداد:

1. ایجاد سند در وضعیت `draft`
2. امضای جداگانه‌ی هر Party در وضعیت `pending_signatures`
3. فعال‌شدن خودکار در وضعیت `active` پس از امضای همه‌ی Partyها

APIها:

- `POST /api/v1/contracts`
- `GET /api/v1/contracts`
- `POST /api/v1/contracts/:id/sign`

برای الزام قرارداد فعال پیش از تبادل داده، مقدار زیر را فعال کنید:

```env
REQUIRE_LEGAL_WRAPPER=true
```

در این حالت، ایجاد فایل بدون mNDA یا MSA فعال با خطای `412 LEGAL_WRAPPER_REQUIRED`
رد می‌شود. ایجاد و امضای قرارداد در Audit Trail با رویدادهای
`contract.created` و `contract.signed` ثبت می‌گردد.

جدول `legal_contracts` با RLS و FORCE RLS در migration
`db/008_legal_contracts.sql` ایجاد می‌شود.
