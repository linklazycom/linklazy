import { createServiceClient } from "@/lib/supabase/service";
import { getSiteSettings } from "@/lib/site-settings";
import { getBonusSettings } from "@/lib/deposit-bonus-server";
import { CRONS, cronHealth, type CronRunRow } from "@/lib/cron-schedule";
import { TEST_MONEY_THRESHOLD, evaluateLaunchReadiness, summarize } from "@/lib/launch-readiness";

export const metadata = { title: "Admin · Launch readiness" };
export const dynamic = "force-dynamic";

/** ISO time N days ago (kept outside the page so the render stays pure). */
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const ICON = { pass: "✅", warn: "⚠️", fail: "❌" } as const;
const MANUAL = [
  "Vercel Pro আপগ্রেড করা হয়েছে (লঞ্চের আগে) এবং ক্রন-ফাংশনের সময়সীমা বাড়ানো",
  "Supabase-এ স্বয়ংক্রিয় ব্যাকআপ আছে এমন প্ল্যান; প্রথম সাপ্তাহিক ডাম্প ও রিস্টোর মহড়া হয়েছে (docs/BACKUP_PLAN.md)",
  "আইনজীবী Terms/Privacy দেখেছেন; LEGAL_UPDATED তারিখ বদলানো (docs/LEGAL_REVIEW_CHECKLIST.md)",
  "Resend-এ SPF/DKIM ✅ ও টেস্ট ইমেইল ইনবক্সে এসেছে (Admin > Operations > Email)",
  "PayPal লাইভ: একটি ছোট আসল টপ-আপ ও একটি আসল অর্ডার নিজের কার্ডে/অ্যাকাউন্টে দিয়ে পরীক্ষা (পরে ফেরত)",
  "Google Search Console-এ সাইট ও সাইটম্যাপ জমা",
  "§৫-এর পুরো টেস্ট তালিকা চালানো হয়েছে ও ফেল ঠিক হয়েছে",
  "ছোট প্রাইভেট বিটা (৫–১০ জন) শেষে বড় সমস্যা নেই",
];

export default async function LaunchReadinessPage() {
  const svc = createServiceClient();
  const settings = await getSiteSettings();
  const bonus = await getBonusSettings(svc);

  const [sites, verified, balances, pending, failed, cronRes] = await Promise.all([
    svc.from("sites").select("id", { count: "exact", head: true }).eq("status", "approved"),
    svc.from("sites").select("id", { count: "exact", head: true }).eq("status", "approved").not("dr_verified", "is", null),
    svc.from("profiles").select("full_name, wallet_balance").gt("wallet_balance", TEST_MONEY_THRESHOLD).order("wallet_balance", { ascending: false }).limit(20),
    svc.from("withdrawal_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "approved"]),
    svc.from("tasks").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", daysAgoIso(7)),
    svc.from("cron_runs").select("name, last_finished_at, last_ok_at, last_status, last_http, last_duration_ms"),
  ]);

  const crons = cronHealth(CRONS, ((cronRes.data ?? []) as CronRunRow[]), new Date());
  const checks = evaluateLaunchReadiness({
    env: process.env,
    data: {
      approvedSites: sites.count ?? 0,
      verifiedSites: verified.count ?? 0,
      testMoneyAccounts: (balances.data ?? []).map((p) => ({ name: (p.full_name as string | null) ?? "User", balance: Number(p.wallet_balance) })),
      pendingWithdrawals: pending.count ?? 0,
      failedTasks7d: failed.count ?? 0,
      cronProblems: crons.filter((x) => x.state === "late" || x.state === "failing").length,
      cronNever: crons.filter((x) => x.state === "never").length,
      depositBonusOn: bonus.enabled,
      signupOpen: String(settings.signup_open ?? "on") !== "off",
    },
  });
  const sum = summarize(checks);
  const groups = Array.from(new Set(checks.map((c) => c.group)));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Launch readiness</h1>
        <p className="text-sm text-muted">লঞ্চের আগে সিস্টেম নিজেই যা যাচাই করতে পারে। গোপন চাবির মান কখনো দেখানো হয় না — শুধু সেট আছে কিনা।</p>
      </div>
      <p className={`rounded-chip p-3 text-sm font-medium ${sum.ready ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
        {sum.ready ? "✅ কোনো ❌ নেই — স্বয়ংক্রিয় চেকে লঞ্চযোগ্য।" : `❌ ${sum.fail}টি বাধা আছে — লঞ্চের আগে ঠিক করুন।`} (⚠️ {sum.warn}, ✅ {sum.pass})
      </p>
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="font-display text-lg font-medium">{g}</h2>
          {checks.filter((c) => c.group === g).map((c) => (
            <div key={c.id} className="rounded-chip border border-line bg-white p-3 text-sm">
              <p className="font-medium">{ICON[c.status]} {c.label}</p>
              <p className="text-xs text-muted">{c.detail}</p>
            </div>
          ))}
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">হাতে-যাচাইয়ের তালিকা (সিস্টেম নিজে জানে না)</h2>
        <ul className="space-y-1 rounded-chip border border-line bg-white p-3 text-sm">
          {MANUAL.map((m) => (
            <li key={m}>☐ {m}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
