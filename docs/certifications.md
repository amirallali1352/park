# گواهی صلاحیت تجهیزات

برای تجهیزاتی با مدل دسترسی `certified_self_service`، کاربر باید گواهی معتبر
داشته باشد. اعتبار گواهی با `expiresAt` کنترل می‌شود و گواهی منقضی‌شده اجازه
رزرو نمی‌دهد.

## صدور گواهی

`POST /api/v1/equipment/{equipmentId}/certifications`

```json
{
  "id": "cert-1",
  "userId": "user-1",
  "expiresAt": "2027-09-01T00:00:00Z"
}
```

در حالت `AUTH_REQUIRED=true` فقط `park_admin` و `tenant_admin` می‌توانند
گواهی صادر کنند.

## مشاهده گواهی‌ها

`GET /api/v1/equipment/{equipmentId}/certifications`

## رزرو

هنگام `POST /api/v1/bookings`، اگر تجهیز `certified_self_service` باشد، وجود
گواهی معتبر برای همان Tenant، تجهیز و کاربر الزامی است. در غیر این صورت پاسخ
`403 CERTIFICATION_REQUIRED` برگردانده می‌شود.

Migration مربوط به این قابلیت:

`db/013_equipment_certifications.sql`
