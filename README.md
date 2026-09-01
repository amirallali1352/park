# STP OS

فاز اول با رویکرد TDD آغاز شده است. دامنه‌ی فعلی شامل هویت، نقش‌ها، مستاجرها، مرزبندی چندمستاجری و API پایه است.

## اجرا

```powershell
npm.cmd test
```

## API پایه

- `GET /health` — بررسی سلامت سرویس
- `POST /api/v1/tenants` — ایجاد Tenant با `id`، `name` و `type`
- `POST /api/v1/users` — ایجاد کاربر با هدر `x-tenant-id`
- `GET /api/v1/users` — فهرست کاربران Tenant جاری با هدر `x-tenant-id`

> هدر `x-tenant-id` در این مرحله نقش شبیه‌ساز context هویت را دارد. در گام بعدی با OIDC/SAML و PostgreSQL RLS جایگزین/تکمیل می‌شود.

## PostgreSQL و RLS

Migration پایه در `db/001_identity.sql` قرار دارد و جداول `tenants` و `users` را ایجاد می‌کند. جدول کاربران با RLS اجباری ایزوله شده و context هر درخواست با مقدار تراکنشی `app.tenant_id` تنظیم می‌شود.

آداپتور `PostgresIdentityRepository` در `src/infrastructure/postgres-identity-repository.js` از Queryهای پارامتری استفاده می‌کند و برای تست‌پذیری به هر کلاینت سازگار با متد `query` وابسته است.

معماری فعلی یک Modular Monolith است. اتصال واقعی به PostgreSQL، Pool مدیریت اتصال و احراز هویت OIDC/SAML در مراحل بعدی به‌عنوان آداپتورهای زیرساختی اضافه خواهد شد.

برای اجرای PostgreSQL توسعه، ابتدا Docker Desktop را اجرا کنید و سپس بزنید:

```powershell
npm.cmd run db:up
```

اتصال میزبان توسعه به PostgreSQL پروژه از طریق پورت `15432` انجام می‌شود تا با PostgreSQL احتمالی نصب‌شده روی ویندوز در پورت `5432` تداخل نداشته باشد.

در زمان توسعه‌ی فعلی، Docker daemon روی سیستم در دسترس نبود؛ بنابراین اجرای کانتینر به مرحله‌ی بعد موکول شد.

## اتصال API به PostgreSQL

اگر متغیر `DATABASE_URL` تنظیم باشد، `src/index.js` به‌صورت خودکار از `PostgresIdentityRepository` استفاده می‌کند؛ در غیر این صورت API برای اجرای تست‌ها از Repository حافظه‌ای استفاده خواهد کرد.

نمونه‌ی اجرای محلی با دیتابیس Docker:

```powershell
$env:DATABASE_URL = "postgres://stp_os:change-me@127.0.0.1:15432/stp_os"
npm.cmd start
```

در این حالت عملیات نوشتن و خواندن کاربران داخل تراکنش انجام می‌شود و context مربوط به Tenant در همان اتصال تنظیم می‌گردد.

## نمونه و زنجیره تحویل

ماژول Sample Tracking برای هر نمونه بارکد یکتا در محدوده‌ی Tenant ایجاد می‌کند و رویدادهای تحویل را ثبت می‌کند:

- `POST /api/v1/samples`
- `GET /api/v1/samples`
- `POST /api/v1/samples/:sampleId/custody`
- `GET /api/v1/samples/:sampleId/custody`

Migration `db/003_samples.sql` جدول‌های `samples` و `sample_custody_events` را ایجاد می‌کند. برای هر دو جدول RLS اجباری فعال است و یکتایی `(tenant_id, barcode)` در سطح PostgreSQL تضمین می‌شود.

## احراز هویت

برای محیط توسعه می‌توان احراز هویت Bearer را فعال کرد:

```powershell
$env:AUTH_REQUIRED = "true"
$env:AUTH_SECRET = "یک-رشته-تصادفی-طولانی"
$env:AUTH_ISSUER = "https://identity.example.com/"
$env:AUTH_AUDIENCE = "stp-os-api"
```

در این حالت، Tenant از Claim به نام `tenantId` در JWT استخراج می‌شود و اگر هدر `x-tenant-id` ارسال شود، با آن تطبیق داده خواهد شد. توکن‌های نامعتبر، منقضی یا دارای امضای اشتباه رد می‌شوند. در صورت تنظیم `AUTH_ISSUER` و `AUTH_AUDIENCE`، Claimهای `iss` و `aud` نیز اعتبارسنجی می‌شوند. پیاده‌سازی فعلی HS256 برای محیط توسعه است؛ اتصال به OIDC/SAML و JWKS در مرحله‌ی سخت‌سازی امنیتی اضافه خواهد شد.

رویدادهای دامنه در جدول Outbox ثبت می‌شوند تا در مرحله‌ی بعد به Kafka یا Redpanda ارسال شوند. جزئیات در `docs/outbox.md` آمده است.

Audit Trail رمزنگاری‌شده نیز برای رویدادهای مهم فعال است. هر رویداد دارای SHA-256 و `previousHash` است و مسیر `GET /api/v1/audit` برای مشاهده‌ی زنجیره‌ی Tenant فراهم شده است. جزئیات در `docs/audit-trail.md` آمده است.
