# Marketplace معکوس

ماژول Marketplace از چهار قالب استاندارد پشتیبانی می‌کند:

- `tech_offer`: پیشنهاد فناوری یا ظرفیت آزمایشگاهی
- `tech_request`: درخواست فناوری
- `rd_request`: درخواست تحقیق و توسعه
- `business_offer`: پیشنهاد تجاری

هر Listing دارای عنوان، خلاصه، قابلیت‌ها، برچسب‌ها، وضعیت و نسخه است. تمام
Listingها به Tenant سازنده محدود هستند و جست‌وجو بر اساس نوع، برچسب و وضعیت
انجام می‌شود.

APIها:

- `POST /api/v1/marketplace/listings`
- `GET /api/v1/marketplace/listings?type=tech_request&tag=materials`
- `POST /api/v1/marketplace/listings/:id/close`

ایجاد و بستن Listing در Audit Trail ثبت می‌شود. جدول PostgreSQL در migration
`db/009_marketplace_listings.sql` ساخته شده و RLS و FORCE RLS برای جداسازی Tenantها
فعال است.

گام بعدی این ماژول، افزودن Semantic Matching با Embedding و تشکیل Consortium برای
درخواست‌های R&D خواهد بود.
