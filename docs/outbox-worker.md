# Outbox Worker

Worker فایل `src/worker.js` رویدادهای `pending` را از PostgreSQL می‌خواند و به
Redpanda ارسال می‌کند.

## اجرای محلی

```powershell
$env:DATABASE_URL = "postgres://stp_os:change-me@127.0.0.1:15432/stp_os"
$env:KAFKA_BROKERS = "127.0.0.1:19092"
npm.cmd run start:worker
```

## اجرای Docker

```powershell
docker compose up -d outbox-worker
docker compose logs -f outbox-worker
```

Producer با `idempotent: true` و تنها یک درخواست هم‌زمان ساخته می‌شود. Worker
شناسه رویداد را در هر چرخه deduplicate می‌کند و فقط پس از موفقیت ارسال، وضعیت
رویداد را از `pending` به `published` تغییر می‌دهد. در صورت خطای Redpanda،
رویداد pending باقی می‌ماند تا چرخه بعدی دوباره تلاش شود.

پیام‌های Kafka دارای headerهای `event-id` و `tenant-id` هستند تا مصرف‌کننده‌ها
بتوانند پردازش idempotent و tenant-aware داشته باشند.
