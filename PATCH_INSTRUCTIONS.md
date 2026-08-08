# GitHub রিপো ক্লিনআপ প্যাচ

এই zip-এ দুইটা ফাইল আছে: `.gitignore` এবং `.env.example`। এগুলো আপনার
`linklazy` রিপোতে যোগ করে দিন এবং ভুলবশত কমিট হয়ে যাওয়া
`tsconfig.tsbuildinfo` রিমুভ করে দিন।

## ধাপ

আপনার লোকাল রিপো ফোল্ডারে গিয়ে (যেখানে `git remote` হিসেবে
`linklazycom/linklazy` কানেক্ট করা আছে):

```
cd linklazy   # আপনার লোকাল রিপো ফোল্ডারের নাম যা-ই হোক

# এই zip থেকে .gitignore এবং .env.example কপি করে রিপো রুটে বসান
# (zip extract করে দুইটা ফাইল copy-paste করুন)

# tsconfig.tsbuildinfo রিমুভ করুন — এটা git-এর ট্র্যাকিং থেকেও সরাতে হবে
git rm --cached tsconfig.tsbuildinfo

git add .gitignore .env.example
git commit -m "Add .gitignore and .env.example, remove stray tsbuildinfo"
git push
```

## এতে কী হবে
- `.gitignore` এখন থেকে `node_modules`, `.next`, `.env.local`, এবং
  `*.tsbuildinfo` — এই সবগুলোকে ভবিষ্যতে কমিট হওয়া থেকে আটকাবে
- `.env.example` রিপোতে থাকবে রেফারেন্স হিসেবে, যাতে কোন env variable
  লাগবে সেটা যে কেউ (বা আপনি নিজেই ভবিষ্যতে) রিপো দেখেই বুঝতে পারে
- `tsconfig.tsbuildinfo` রিপো থেকে সরে যাবে (লোকাল ডিস্কে থাকবে, শুধু
  git থেকে বাদ যাবে — কোনো কাজে সমস্যা হবে না, এটা শুধু একটা ক্যাশ ফাইল)

এরপর `git push` করলেই Vercel-এ auto-redeploy হয়ে যাবে (কোনো ফাংশনাল
পরিবর্তন নেই, তাই সাইটে কোনো প্রভাব পড়বে না)।
