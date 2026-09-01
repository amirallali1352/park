# ماتریس دسترسی

وقتی `AUTH_REQUIRED=true` باشد، عملیات مالی فقط برای نقش‌های زیر مجاز است:

| عملیات | `park_admin` | `tenant_admin` | `member` |
|---|---:|---:|---:|
| ایجاد Escrow | مجاز | مجاز | ممنوع |
| تأیید Escrow | مجاز | مجاز | ممنوع |
| آزادسازی Escrow | مجاز | مجاز | ممنوع |
| صدور Voucher | مجاز | مجاز | ممنوع |
| اعمال Voucher | مجاز | مجاز | ممنوع |

در حالت توسعه‌ای که `AUTH_REQUIRED=false` است، برای حفظ سازگاری تست و توسعه،
هدر `x-tenant-id` همچنان context درخواست را فراهم می‌کند. در محیط staging و
production باید `AUTH_REQUIRED=true` و `AUTH_SECRET` یک مقدار تصادفی و امن باشد.
