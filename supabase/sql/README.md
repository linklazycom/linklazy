# Supabase SQL — চালানোর ক্রম

> Supabase → SQL Editor-এ ফাইল খুলে পেস্ট করে Run করুন। প্রতিটি ফাইল আবার চালালেও সমস্যা নেই (013a শুধু পড়ে, কিছু বদলায় না)।

## Batch 2 (সম্পন্ন হলে টিক দিন)
- [ ] `010_lock_down_wallet_functions.sql`
- [ ] `011_protect_profiles.sql`
- [ ] (কোড ডিপ্লয়ের পরে) `012_protect_sites_and_verifications.sql`

## Batch 3 — ক্রম গুরুত্বপূর্ণ
1. **`013a_preflight_check.sql`** চালিয়ে সব রেজাল্ট আমাকে পাঠান (কিছু বদলায় না)।
   বিশেষ করে ৩, ৫, ৬ নম্বর কোয়েরির ফল — এগুলো দেখাবে কোনো পেমেন্ট ভুলভাবে "পরিশোধিত" ধরা হয়েছে কিনা।
2. GitHub-এ এই ব্যাচের **কোড ফাইলগুলো আপলোড** → Vercel ডিপ্লয় শেষ হওয়ার অপেক্ষা
   - **৩ নম্বর কোয়েরিতে সারি এলে বা wallet payment row না থাকলে** accept কোড ডিপ্লয়ের আগে আমাকে জানান।
3. **`013_protect_orders.sql`** চালান (কোড ডিপ্লয়ের পরে)
4. **`014_fix_reviews.sql`** চালান

## Batch 3 টেস্ট চেকলিস্ট
- বিকাশ দিয়ে ছোট অঙ্কের ওয়ালেট টপ-আপ → একবারই জমা হয়, ব্যালেন্স ও লেজার মেলে
- PayPal দিয়ে ছোট টপ-আপ, PayPal দিয়ে একটি অর্ডার পেমেন্ট
- পেমেন্ট সফল হলে অর্ডার "pending_seller_acceptance" এ যায়
- পেমেন্ট না করে/বাতিল করে ফিরে এলে অর্ডার `pending_payment` থাকে
- পূর্ণ ফ্লো: অর্ডার → পেমেন্ট → সেলার accept → deliver → বায়ার accept → সেলারের ওয়ালেটে টাকা
- ওয়ালেট দিয়ে অর্ডার করে একই ফ্লো (সবচেয়ে গুরুত্বপূর্ণ, কারণ ওয়ালেট পেমেন্টের রেকর্ড আলাদা)
- এক্সচেঞ্জ ম্যাচ accept করলে দুটি অর্ডার তৈরি হয়
- ডিসপিউট খোলা যায়; রিভিউ দেওয়া যায় (একবারই)

## কিছু ভেঙে গেলে (রোলব্যাক)
```sql
drop trigger if exists trg_protect_profile_columns on public.profiles;
drop trigger if exists trg_protect_site_columns on public.sites;
drop trigger if exists trg_protect_site_verifications on public.site_verifications;
drop trigger if exists trg_protect_order_columns on public.orders;
```
