# Supabase SQL — চালানোর ক্রম

> Supabase → SQL Editor-এ ফাইল খুলে পেস্ট করে Run করুন। প্রতিটি ফাইল আবার চালালেও সমস্যা নেই।

1. **`010_lock_down_wallet_functions.sql`** — এখনই চালান (কোড পরিবর্তন লাগে না)
2. **`011_protect_profiles.sql`** — এখনই চালান (কোড পরিবর্তন লাগে না)
3. **GitHub-এ এই ব্যাচের 2টি কোড ফাইল আপলোড → Vercel ডিপ্লয় শেষ হওয়ার পর**
4. **`012_protect_sites_and_verifications.sql`** — ডিপ্লয়ের পরে চালান

## চালানোর পর টেস্ট
- নতুন সাইট সাবমিট করুন → "pending" থাকে, DR ভেরিফাইড দেখায়
- সাইটের ভেরিফিকেশন বাটন কাজ করে
- ওয়ালেট টপ-আপ, Pay-Per-View আনলক, বাল্ক অর্ডার ওয়ালেট দিয়ে কাজ করে
- "Become seller" বাটন কাজ করে; নতুন রেজিস্ট্রেশন (রেফারাল কোডসহ) কাজ করে
- অ্যাডমিন থেকে সাইট Approve/Reject, ইউজার ব্যান/ফ্ল্যাগ কাজ করে

## কিছু ভেঙে গেলে (রোলব্যাক)
```sql
drop trigger if exists trg_protect_profile_columns on public.profiles;
drop trigger if exists trg_protect_site_columns on public.sites;
drop trigger if exists trg_protect_site_verifications on public.site_verifications;
```
