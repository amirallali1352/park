# رمزنگاری فایل و ذخیره‌سازی شیء

## Envelope Encryption

برای هر فایل یک کلید داده‌ی یکتا (DEK) با طول ۳۲ بایت تولید می‌شود. محتوای فایل با
AES-256-GCM رمزنگاری می‌شود و DEK با کلید رمزنگاری کلید (KEK) محافظت می‌شود.
در Envelope فقط داده‌های رمزنگاری‌شده و متادیتای لازم نگهداری می‌شود و متن خام فایل
به API برگردانده نمی‌شود.

کلید `ENCRYPTION_KEK` باید یک راز طولانی و تصادفی باشد و در محیط تولید داخل KMS/HSM
نگهداری شود؛ مقدار موجود در `.env.example` فقط نمونه‌ی توسعه است.

مسیرهای توسعه‌ی فعلی:

- `POST /api/v1/files/encrypt` با `x-tenant-id`، `objectId` و `contentBase64`
- `POST /api/v1/files/decrypt` با `x-tenant-id` و `envelope`

هر Envelope به `tenantId` و `objectId` وابسته است و تلاش برای استفاده در Tenant
دیگر رد می‌شود.

## MinIO / S3

فایل `docker-compose.yml` سرویس سازگار با S3 را با نام `minio` فراهم می‌کند:

- API: پورت `9000`
- Console: پورت `9001`
- کاربر توسعه: `stp_minio`
- رمز توسعه: `change-me-minio`

در محیط تولید باید رمزها، Bucket Policy و دسترسی‌ها از Secret Manager تأمین شوند.
گام بعدی، اتصال یک Object Storage Adapter به Envelope و انتقال ciphertext به Bucket
است؛ PostgreSQL فقط متادیتای Envelope و وضعیت فایل را نگهداری خواهد کرد.

در مرحله‌ی فعلی این اتصال انجام شده است. جدول `file_metadata` در migration
`db/007_file_metadata.sql` ایجاد می‌شود و شامل Tenant، Bucket، کلید شیء، نوع محتوا،
اندازه و نسخه‌ی Envelope است. این جدول با RLS و FORCE RLS از مرز Tenant محافظت
می‌شود. ایجاد و حذف فایل نیز در Audit Trail با رویدادهای `file.created` و
`file.deleted` ثبت می‌شوند.
