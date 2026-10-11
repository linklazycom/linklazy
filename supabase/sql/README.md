# Supabase SQL — চালানোর ক্রম

> Supabase → SQL Editor-এ ফাইল খুলে পেস্ট করে Run করুন। প্রতিটি ফাইল আবার চালালেও সমস্যা নেই।
> **`013b` আর `013c` আলাদা আলাদা Run করতে হবে** (একসাথে নয়), কারণ নতুন enum মান একই Run-এ ব্যবহার করা যায় না।

## Batch 2
- [ ] `010_lock_down_wallet_functions.sql`
- [ ] `011_protect_profiles.sql`
- [ ] (কোড ডিপ্লয়ের পরে) `012_protect_sites_and_verifications.sql`

## Batch 3 — এই ক্রমেই
1. [ ] `013b_add_payment_provider_values.sql` → Run (শুধু ২টি `alter` লাইন; এরপর আলাদা Run-এ চেক-কোয়েরি)
2. [ ] `013c_backfill_wallet_payment_records.sql` → আলাদা Run। শেষের চেক-কোয়েরিতে কোনো সারি আসা উচিত না (এলে আমাকে জানান)
3. [ ] GitHub-এ Batch 3-এর কোড ফাইল (৫টি) আপলোড → Vercel ডিপ্লয় শেষ হওয়ার অপেক্ষা
4. [ ] `013_protect_orders.sql` → Run
5. [ ] `014_fix_reviews.sql` → Run

## Batch 3 টেস্ট চেকলিস্ট
- ছোট অঙ্কের ওয়ালেট অর্ডার করুন (টেস্ট অ্যাকাউন্ট দিয়ে) → `payments` টেবিলে `wallet` / `held_escrow` সারি তৈরি হয়েছে কিনা দেখুন:
  `select order_id, provider::text, status::text, amount from payments order by created_at desc limit 5;`
- পূর্ণ ফ্লো: অর্ডার → সেলার accept → deliver → বায়ার accept → সেলারের ওয়ালেটে ৯০%
- **আগের ৩টি `delivered` অর্ডারে** (4d420147…, 9faa7ba9…, ef05c1ad…) Accept কাজ করে
- PayPal দিয়ে ছোট টপ-আপ (এখন প্রথমবার কাজ করার কথা), বিকাশ দিয়ে ছোট টপ-আপ
- পেমেন্ট বাতিল করে ফিরলে অর্ডার `pending_payment` থাকে
- এক্সচেঞ্জ ম্যাচ accept, ডিসপিউট খোলা, রিভিউ (একবারই)

## কিছু ভেঙে গেলে (রোলব্যাক)
```sql
drop trigger if exists trg_protect_profile_columns on public.profiles;
drop trigger if exists trg_protect_site_columns on public.sites;
drop trigger if exists trg_protect_site_verifications on public.site_verifications;
drop trigger if exists trg_protect_order_columns on public.orders;
```
