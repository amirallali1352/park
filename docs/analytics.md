# Analytics و KPI Pipeline

لایه‌ی Analytics فعلی از رویدادهای دامنه تغذیه می‌شود و برای هر Tenant این شاخص‌ها
را نگهداری می‌کند:

- تعداد Booking
- دقایق استفاده از تجهیزات
- هزینه‌ی R&D
- خروجی اقتصادی ثبت‌شده

Aggregator به‌صورت idempotent کار می‌کند و یک رویداد را دوباره محاسبه نمی‌کند.
داشبورد Tenant-scoped از مسیر زیر در دسترس است:

```text
GET /api/v1/analytics/kpis
```

Sink ClickHouse برای ذخیره‌ی رویدادهای تحلیلی آماده شده است. تنظیمات:

```env
CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_DATABASE=stp_os
CLICKHOUSE_EVENTS_TABLE=stp_events
```

Schema اولیه در `db/clickhouse/001_events.sql` قرار دارد و سرویس توسعه‌ی
ClickHouse در Docker روی پورت `8123` تعریف شده است. در این مرحله Container به‌دلیل
دانلود طولانی Image اجرا نشد، اما Compose، Client، schema و تست‌ها آماده هستند.
