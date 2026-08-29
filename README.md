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

معماری فعلی یک Modular Monolith است و پیاده‌سازی پایگاه‌داده‌ی PostgreSQL/RLS و OIDC/SAML در گام‌های بعدی به‌عنوان آداپتورهای زیرساختی اضافه خواهد شد.
