# Semantic Matching و Consortium

ماژول Matching فعلی یک موتور قابل‌توسعه برای رتبه‌بندی Listingهاست. در نسخه‌ی
اول، شباهت بر اساس قابلیت‌ها، برچسب‌ها و متن عنوان/خلاصه محاسبه می‌شود:

- هر قابلیت مشترک: ۵ امتیاز
- هر برچسب مشترک: ۳ امتیاز
- هر تطابق متنی: ۱ امتیاز

فقط Listingهای `open` و نوع‌های سازگار وارد نتیجه می‌شوند. برای Discovery بین
Tenantها از مسیر جداگانه‌ی Matching استفاده شده و عملیات مدیریتی Listing همچنان
Tenant-scoped باقی می‌ماند.

APIها:

- `POST /api/v1/marketplace/match`
- `POST /api/v1/marketplace/consortia`
- `GET /api/v1/marketplace/consortia`

Consortium برای یک درخواست R&D با حداقل دو عضو مستقل ساخته می‌شود و برنامه‌ی
حمایتی مانند `TÜBİTAK` یا `EU` را نگهداری می‌کند. اطلاعات Consortium در جدول
`consortia` با RLS و FORCE RLS ذخیره می‌شود.

در گام بعدی می‌توان Provider واقعی Embedding، جست‌وجوی برداری OpenSearch و
Workflow ارسال Consortium به فراخوان‌های رسمی را به این Interface متصل کرد.
