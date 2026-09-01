# ممیزی انطباق با Blueprint اصلی

تاریخ ممیزی: 2026-09-01

## خلاصه

هر پنج فاز در کد شروع شده‌اند. سه فاز اول از نظر هسته‌ی مهندسی به وضعیت
قابل‌استفاده رسیده‌اند و فازهای چهار و پنج هنوز بخشی از مسیر production و
تجاری‌سازی را ندارند.

برآورد فعلی پیشرفت مهندسی: **حدود 68٪ تکمیل**  
باقی‌مانده: **حدود 32٪**

این درصد، برآورد پوشش قابلیت‌های مشخص‌شده در سند است؛ معیار آن تعداد commit یا
تعداد فایل نیست.

## ماتریس فازها

| فاز | وضعیت | پوشش تقریبی | توضیح |
|---|---|---:|---|
| 1. Product/Core Modules | عمدتاً انجام‌شده | 85٪ | تجهیزات، رزرو، CoC، Certification، Marketplace، Matching و Consortium موجود است؛ اتصال واقعی دستگاه‌های آزمایشگاهی و اتوماسیون Grant باقی است. |
| 2. Security/IP/Audit | جزئی تا عمدتاً انجام‌شده | 65٪ | mNDA/MSA، امضا، Hash Chain، Merkle، RLS، رمزنگاری Envelope و Audit موجود است؛ OIDC/SAML/JWKS، TSA، WORM و DLP سازمانی باقی است. |
| 3. Distributed Architecture | عمدتاً انجام‌شده | 85٪ | Modular Monolith، DDD اولیه، REST، Outbox، Redpanda، Worker و قفل زمانی PostgreSQL موجود است؛ gRPC و Transactional Outbox کاملاً اتمیک باقی است. |
| 4. Big Data/Analytics | جزئی | 65٪ | PostgreSQL، S3/MinIO، OpenSearch adapter، ClickHouse sink و KPI موجود است؛ OpenSearch/ClickHouse production، WORM و Data Governance کامل باقی است. |
| 5. Business/Roadmap | نمونه‌ی فنی | 40٪ | Voucher و Escrow پایه موجود است؛ Subscription، Billing واقعی، PSP، Take-rate، Voucher provider و Pilot UI/عملیاتی باقی است. |

## مواردی که انجام شده‌اند

- Multi-tenancy با PostgreSQL RLS و FORCE RLS
- مدیریت تجهیزات، رزرو و جلوگیری از هم‌پوشانی زمانی
- مدل‌های `operator_assisted` و `certified_self_service`
- گواهی صلاحیت کاربر برای تجهیزات سلف‌سرویس
- مدیریت Sample و Chain of Custody
- Marketplace چهار نوع Listing و Semantic Matching
- تشکیل Consortium
- mNDA/MSA و امضای دیجیتال محلی
- Hash Chain و Merkle Proof برای Audit
- Envelope Encryption و اتصال S3/MinIO
- Escrow، Voucher و کنترل نقش مالی
- Outbox و انتشار idempotent به Redpanda
- Login با scrypt، JWT، Audit و Login Rate Limit
- migration خودکار در startup
- 140 تست خودکار موفق

## کمبودهای باقی‌مانده

### نیازمند پیاده‌سازی نرم‌افزاری

- Transactional Outbox اتمیک در یک تراکنش مشترک بین aggregate و outbox
- gRPC API در کنار REST
- داشبورد وب و تجربه کاربری Pilot
- Billing، Subscription، Invoice و Take-rate
- Provider abstraction برای پرداخت و تسویه
- Adapter استاندارد برای داده‌ی خام GC-MS، SEM، HPLC، DICOM و HDF5
- workflow کامل درخواست Grant و گزارش‌دهی آن

### نیازمند سرویس یا قرارداد خارجی

- اتصال OIDC/SAML/JWKS به Identity Provider واقعی
- اتصال Timestamping Authority برای TSA
- WORM/Immutable Object Lock در محیط ذخیره‌سازی واقعی
- DLP سازمانی، KMS/HSM و سیاست‌های جلوگیری از نشت داده
- PSP، حساب امانی بانکی و خزانه‌ی دولتی
- اجرای production برای OpenSearch و ClickHouse
- ارزیابی حقوقی GDPR/KVKK و e-signature محلی

## اعتبارسنجی فعلی

- `npm.cmd test`: **140 passed**
- PostgreSQL: healthy
- Redpanda: healthy
- MinIO: running
- Outbox Worker: running
- migrationهای 001 تا 013: قابل اجرای مجدد و idempotent
- API production با PostgreSQL: `/health` موفق

## اولویت ادامه

1. Transactional Outbox اتمیک و observability
2. اجرای OpenSearch و ClickHouse
3. Billing/PSP abstraction
4. OIDC/SAML/JWKS
5. Pilot UI و داشبورد عملیاتی
