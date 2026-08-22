# Next.js 16 আপগ্রেড — ডেলিভারি নোট

## ⚠️ ম্যানুয়াল স্টেপ (এইটা মিস করলে সাইট ভাঙবে)
GitHub drag-and-drop দিয়ে ফাইল **ওভাররাইট/অ্যাড** হয়, ডিলিট হয় না। এই আপগ্রেডে
`middleware.ts` **রিমুভ** করে `proxy.ts` দিয়ে রিপ্লেস করা হয়েছে (Next.js 16-এর
নতুন কনভেনশন)। তাই zip আপলোড করার পর GitHub-এ গিয়ে repo-র রুট থেকে
**`middleware.ts` ফাইলটা ম্যানুয়ালি ডিলিট করে দেবেন।** দুটো ফাইল (middleware.ts
আর proxy.ts) একসাথে থাকলে কনফ্লিক্ট/আনপ্রেডিক্টেবল বিহেভিয়ার হতে পারে।

## Node.js ভার্সন — এখন package.json-এই সেট করা আছে
আগে বলেছিলাম Vercel Settings → General-এ গিয়ে Node ভার্সন সেট করতে — কিন্তু
Vercel সম্প্রতি এই সেটিংসটা **General থেকে "Build and Deployment" পেজে**
সরিয়ে ফেলেছে, তাই খুঁজে না পাওয়াটাই স্বাভাবিক। UI খোঁজার ঝামেলা এড়াতে আমি
সরাসরি `package.json`-এ যোগ করে দিয়েছি:
```json
"engines": { "node": "22.x" }
```
এটা Vercel-এর প্রজেক্ট সেটিংসে যা-ই সেট করা থাকুক, সবসময় override করে দেবে —
তাই ড্যাশবোর্ডে গিয়ে আলাদা করে কিছু সেট করার দরকার নেই। শুধু নিশ্চিত করবেন
এই zip-এর `package.json` GitHub-এ আপলোড হয়েছে।

(চাইলে Vercel ড্যাশবোর্ডে গিয়ে ভেরিফাই করতে পারেন: **Settings → Build and
Deployment → Node.js Version** — deploy হওয়ার পর এখানে "22.x" দেখানোর কথা।)

## যা বদলেছে
- `package.json` / `package-lock.json` — `next` 15.5.23 → **16.3.2**, `react`/`react-dom` → 19.2.8, `eslint-config-next` → 16.3.2, `eslint` **^9.16.0-এ রাখা হয়েছে** (10.x-এ eslint-plugin-react-এর সাথে কম্প্যাটিবিলিটি ভাঙে — নিচে বিস্তারিত)
- `middleware.ts` → `proxy.ts` (rename, কনটেন্ট অপরিবর্তিত)
- `eslint.config.mjs` — নতুন ফাইল, কারণ Next 16 `next lint` কমান্ড রিমুভ করেছে; এখন `npm run lint` প্লেইন ESLint চালায়
- `tsconfig.json` / `next-env.d.ts` — `next typegen`-এর মান্ডেটরি আপডেট (jsx মোড, route-type ইমপোর্ট)

## যা ইচ্ছাকৃতভাবে বদলাইনি
- Cache Components / `use cache` — আপগ্রেড CLI ডিফেন্সিভলি ৬৮টা page/layout ফাইলে `export const instant = false;` যোগ করেছিল, কিন্তু এই ফিচারটা `next.config.js`-এ `cacheComponents: true` ছাড়া কাজই করে না (আর সেই ফ্ল্যাগ আমরা enable করিনি) — এটা যোগ করলে বিল্ড **ভেঙে যাচ্ছিল** (৭১টা এরর)। তাই ওই লাইনগুলো বাদ দিয়েছি; কোডবেস আগের মতোই ক্লাসিক caching মডেলে চলবে। Cache Components পরে আলাদা, প্ল্যান করা সেশনে অ্যাডপ্ট করা উচিত — বড় আর্কিটেকচারাল সিদ্ধান্ত, তাড়াহুড়ো করার মতো না।

## ভেরিফিকেশন করেছি
- ✅ `npx tsc --noEmit` — পুরো প্রজেক্ট, ০ এরর
- ✅ `npm run build` (Turbopack production build) — ক্লিন, শুধু Google Fonts fetch ৩টা warning/error দেখাচ্ছিল **আমার sandbox-এর নেটওয়ার্ক রেস্ট্রিকশনের কারণে** (fonts.googleapis.com আমার এই sandbox থেকে reachable না) — এটা কোডের সমস্যা না, Vercel-এ normal internet access থাকায় এটা প্রবলেম হবে না। তারপরও **প্রথম Vercel preview deploy-এ বিল্ড লগ একবার চোখ বুলিয়ে নেবেন** নিশ্চিত হতে।
- ✅ `npx eslint .` — টুলিং কাজ করছে, ৪৫টা pre-existing lint ফাইন্ডিং দেখাচ্ছে (বেশিরভাগ নতুন `react-hooks/set-state-in-effect` রুল, যেটা আগে ছিল না) — এগুলো migration-blocking না, আলাদা cleanup পাস হিসেবে চাইলে পরে ঠিক করা যায়।

## ডিপ্লয়মেন্ট চেকলিস্ট (আপনার জন্য)
1. zip-এর ফাইলগুলো GitHub-এ drag-and-drop (এতে নতুন `package.json`-এর `engines.node: "22.x"` Node ভার্সন নিজে থেকেই হ্যান্ডল করবে)
2. `middleware.ts` ম্যানুয়ালি ডিলিট করুন (উপরে দেখুন)
3. Vercel preview deploy-এর বিল্ড লগ চেক করুন
4. Preview URL-এ লগইন/সেশন ফ্লো টেস্ট করুন (proxy.ts-এর সবচেয়ে বড় রিস্ক এরিয়া) — একটা buyer flow, একটা admin route, আর একটা bKash/PayPal টেস্ট পেমেন্ট
5. সব ঠিক থাকলে প্রোডাকশনে merge

কোনো SQL migration লাগবে না এই আপগ্রেডে।
