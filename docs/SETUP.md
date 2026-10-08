# LinkLazy — সেটআপ গাইড

## ১. ফোল্ডার কাঠামো (গুরুত্বপূর্ণ ফাইল)
- `app/` — Next.js পেজ ও API route
- `components/`, `lib/` — UI ও বিজনেস লজিক
- `proxy.ts` — সেশন রিফ্রেশ (আগের `middleware.ts` এর জায়গায়; দুটো একসাথে থাকলে সমস্যা)
- `vercel.json` — ৭টি cron job
- `supabase/` — স্কিমা রেফারেন্স ও SQL (নিচে দেখুন)

## ২. Supabase
1. স্কিমা রেফারেন্স: `supabase/schema_reference.sql` (শুধু ডকুমেন্টেশন, চালানোর জন্য নয়)।
2. SQL ফাইলগুলো (RPC/ট্রিগার/RLS) `supabase/sql/` ফোল্ডারে রাখুন — কোডে যেসব ফাইলের নাম উল্লেখ আছে:
   `001_atomic_wallet_adjust.sql`, `002_enforce_signup_open.sql`, `002_public_profiles.sql`,
   `004_custom_access_token_hook.sql`, `pay_per_view_wallet.sql`
3. স্টোরেজ বাকেট: `avatars` (পাবলিক)।
4. ভিউ/টেবিল যা কোড ব্যবহার করে কিন্তু স্কিমা এক্সপোর্টে নেই: `public_profile_cards`, `fraud_signals`।
5. RPC ফাংশন: `adjust_wallet_balance`, `place_bulk_order_with_wallet`, `unlock_site_with_wallet`।

## ৩. Vercel
- Node: `package.json`-এ `engines.node = 22.x` সেট আছে।
- Environment Variables: `.env.example` দেখুন। Production আর Preview-তে আলাদা মান রাখুন
  (Preview-তে PayPal/bKash sandbox ব্যবহার করাই নিরাপদ)।
- Cron (`vercel.json`): প্রতিটি route `Authorization: Bearer $CRON_SECRET` চায়।
  **Hobby প্ল্যানে** cron দিনে সর্বোচ্চ ১ বার চলে এবং ফাংশনের সময়সীমা কম;
  `dr-refresh`-এ `maxDuration = 300` আছে — লঞ্চের আগে Pro প্ল্যান লাগবে।

## ৪. পেমেন্ট (লাইভ মোড চেকলিস্ট)
- `PAYPAL_BASE_URL=https://api-m.paypal.com` ও লাইভ client id/secret
- `BKASH_BASE_URL` লাইভ URL ও লাইভ credentials
- `NEXT_PUBLIC_SITE_URL` অবশ্যই production ডোমেইন (callback এখান থেকে তৈরি হয়)
- একটি ছোট টাকার ওয়ালেট টপ-আপ টেস্ট করে ওয়ালেট লেজারে এন্ট্রি মিলিয়ে দেখুন

## ৫. ইমেইল (Resend)
- ডোমেইন ভেরিফাই (SPF, DKIM), তারপর `RESEND_API_KEY` ও `EMAIL_FROM` সেট করুন।
- সেট না থাকলে ইমেইল কোনো এরর ছাড়াই বাদ যায় — ব্যবহারকারী নোটিফিকেশন পাবে না।

## ৬. GitHub-এ আপলোডের নিয়ম
- `.env.local`, `.env`, `node_modules`, `.next` কখনো আপলোড করবেন না।
- Drag-and-drop ফাইল ডিলিট করে না। যা বাদ দেওয়ার, ব্যাচের "ডিলিট লিস্ট" দেখে GitHub-এ গিয়ে হাতে ডিলিট করুন।
