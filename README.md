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
