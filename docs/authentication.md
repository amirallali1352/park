# احراز هویت ایمیل و رمز عبور

Login در نسخه فعلی با JWT و هش `scrypt` انجام می‌شود. متن ساده رمز عبور در
پایگاه داده ذخیره نمی‌شود.

## ساخت کاربر آزمایشی

```powershell
$env:DATABASE_URL = "postgres://stp_os:change-me@127.0.0.1:15432/stp_os"
$env:AUTH_SECRET = "dev-only-change-this-to-a-long-random-secret"
$env:AUTH_REQUIRED = "true"
npm.cmd start
```

سپس کاربر را با این endpoint ایجاد کنید:

`POST /api/v1/users`

Header:

```text
x-tenant-id: park-1
Content-Type: application/json
```

Body:

```json
{
  "id": "test-admin-1",
  "email": "admin@park.local",
  "password": "Admin-pass-123!",
  "role": "park_admin"
}
```

## ورود

`POST /api/v1/auth/login`

```json
{
  "tenantId": "park-1",
  "email": "admin@park.local",
  "password": "Admin-pass-123!"
}
```

در پاسخ، `accessToken` را در header زیر برای درخواست‌های محافظت‌شده ارسال کنید:

```text
Authorization: Bearer <accessToken>
```

در محیط PostgreSQL، ارسال `tenantId` هنگام Login لازم است تا جست‌وجوی کاربر
با RLS در محدوده همان Tenant انجام شود.

## پروفایل کاربر جاری

`GET /api/v1/auth/me`

این مسیر به Bearer token نیاز دارد و فقط شناسه کاربر، Tenant، نقش و ایمیل موجود
در JWT را برمی‌گرداند.

## Audit احراز هویت

Login موفق با رویداد `auth.login.succeeded` و Login ناموفق با رویداد
`auth.login.failed` در زنجیره Audit ثبت می‌شود. Payload فقط شامل ایمیل و علت
ناموفق‌بودن است و هرگز شامل رمز عبور نیست.
