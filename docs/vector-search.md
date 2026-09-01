# جست‌وجوی معنایی برداری

لایه‌ی Search اکنون دو بخش قابل‌تعویض دارد:

- `LocalEmbeddingProvider`: تولید بردار deterministic برای توسعه و تست
- `OpenSearchVectorIndex`: ایندکس Listing و جست‌وجوی KNN

در حالت فعال‌بودن OpenSearch، با ایجاد Listing متن عنوان، خلاصه، قابلیت‌ها و
برچسب‌ها به Embedding تبدیل و در ایندکس `marketplace-vectors` ثبت می‌شود.
مسیر `POST /api/v1/marketplace/match` از جست‌وجوی برداری استفاده می‌کند؛ در نبود
OpenSearch، موتور امتیازدهی قابلیت/برچسب قبلی به‌عنوان fallback باقی می‌ماند.

تنظیمات:

```env
OPENSEARCH_NODE=http://127.0.0.1:9200
OPENSEARCH_INDEX=marketplace-vectors
EMBEDDING_DIMENSIONS=64
```

OpenSearch توسعه‌ای در Docker روی پورت `9200` تعریف شده است. Provider محلی برای
Production جایگزین مدل Embedding واقعی نیست؛ برای محیط عملیاتی باید Provider
سازگار با مدل سازمانی یا سرویس مورد تأیید انتخاب شود و ابعاد آن با Mapping ایندکس
یکسان باشد.
