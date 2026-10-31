/**
 * Pre-launch checks (Batch 22). Pure: takes the environment flags and a few database numbers and
 * answers "is this ready for real customers?". Tested in tests/launch-readiness.test.ts.
 * Secret VALUES are never read here; only whether they are set (the caller passes plain strings for
 * non-secret settings such as base URLs).
 */
export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  group: "Payments" | "Site & email" | "Data" | "Operations";
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface LaunchInput {
  env: Record<string, string | undefined>;
  data: {
    approvedSites: number;
    verifiedSites: number;
    testMoneyAccounts: { name: string; balance: number }[]; // accounts holding a large balance
    pendingWithdrawals: number;
    failedTasks7d: number;
    cronProblems: number; // late or failing
    cronNever: number; // no run recorded yet
    depositBonusOn: boolean;
    signupOpen: boolean;
  };
}

export const TEST_MONEY_THRESHOLD = 10_000; // BDT; any account holding more than this is listed for review
export const LISTING_TARGET = 100;

const set = (v: string | undefined) => !!v && v.trim().length > 0;

export function evaluateLaunchReadiness({ env, data }: LaunchInput): Check[] {
  const c: Check[] = [];
  const add = (id: string, group: Check["group"], label: string, status: CheckStatus, detail: string) => c.push({ id, group, label, status, detail });

  // ---- Payments ----
  const paypal = (env.PAYPAL_BASE_URL ?? "").trim();
  if (!set(env.PAYPAL_CLIENT_ID) || !set(env.PAYPAL_CLIENT_SECRET)) add("paypal_keys", "Payments", "PayPal keys", "fail", "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in Vercel.");
  else add("paypal_keys", "Payments", "PayPal keys", "pass", "Client id and secret are set.");
  if (paypal === "https://api-m.paypal.com") add("paypal_live", "Payments", "PayPal is in LIVE mode", "pass", "PAYPAL_BASE_URL points to the live PayPal.");
  else if (/sandbox/i.test(paypal)) add("paypal_live", "Payments", "PayPal is in LIVE mode", "fail", "PAYPAL_BASE_URL is the SANDBOX. Real customers could not pay. Switch to https://api-m.paypal.com with live keys before launch.");
  else add("paypal_live", "Payments", "PayPal is in LIVE mode", "warn", "PAYPAL_BASE_URL is not set to the live address.");
  add("paypal_webhook", "Payments", "PayPal backup webhook", set(env.PAYPAL_WEBHOOK_ID) ? "pass" : "warn", set(env.PAYPAL_WEBHOOK_ID) ? "PAYPAL_WEBHOOK_ID is set (remember: the LIVE webhook has a different ID from the sandbox one)." : "PAYPAL_WEBHOOK_ID not set: a buyer who pays and closes the tab will not be completed automatically.");
  const bkash = (env.BKASH_BASE_URL ?? "").trim();
  if (!set(bkash)) add("bkash_live", "Payments", "bKash", "warn", "bKash is not configured (fine only if you will not offer bKash at launch).");
  else if (/sandbox/i.test(bkash)) add("bkash_live", "Payments", "bKash is in LIVE mode", "fail", "BKASH_BASE_URL is a SANDBOX address. Use the live URL and live credentials.");
  else add("bkash_live", "Payments", "bKash is in LIVE mode", "pass", "BKASH_BASE_URL is not a sandbox address.");

  // ---- Site & email ----
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!/^https:\/\//.test(site) || /localhost|127\.0\.0\.1/.test(site)) add("site_url", "Site & email", "NEXT_PUBLIC_SITE_URL", "fail", "Must be your real https:// domain (payment callbacks and emails are built from it).");
  else if (/\.vercel\.app/.test(site)) add("site_url", "Site & email", "NEXT_PUBLIC_SITE_URL", "warn", "Still a vercel.app address. Switch to your own domain before launch.");
  else add("site_url", "Site & email", "NEXT_PUBLIC_SITE_URL", "pass", "Real https domain.");
  add("resend", "Site & email", "Email sending (Resend)", set(env.RESEND_API_KEY) && set(env.EMAIL_FROM) ? "pass" : "fail", set(env.RESEND_API_KEY) && set(env.EMAIL_FROM) ? "Key and sender are set. Use Admin > Operations > Email to confirm DNS and a test mail." : "RESEND_API_KEY or EMAIL_FROM missing: no order, payout or alert emails will go out.");
  add("cron_secret", "Site & email", "CRON_SECRET", set(env.CRON_SECRET) ? "pass" : "fail", set(env.CRON_SECRET) ? "Set." : "Missing: scheduled jobs are refused.");
  add("service_key", "Site & email", "Server database key", set(env.SUPABASE_SERVICE_ROLE_KEY) ? "pass" : "fail", set(env.SUPABASE_SERVICE_ROLE_KEY) ? "Set." : "SUPABASE_SERVICE_ROLE_KEY missing.");
  const hash = (env.LINK_HASH_SECRET ?? "").length >= 16 || (env.PROVIDER_KEY_ENCRYPTION_SECRET ?? "").length >= 16;
  add("hash_secret", "Site & email", "Short-link visitor hashing", hash ? "pass" : "warn", hash ? "A secret is available." : "No LINK_HASH_SECRET (16+ chars): unique-visitor counting is switched off.");
  const ai = ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"].some((k) => set(env[k]));
  add("ai_key", "Site & email", "AI provider key", ai ? "pass" : "warn", ai ? "At least one AI key is set." : "No AI key set: AI tools will not work (fine only if they are switched off).");
  add("signup", "Site & email", "Sign-ups", data.signupOpen ? "pass" : "warn", data.signupOpen ? "Open." : "Sign-ups are CLOSED (Admin > Settings). Open them when you launch.");

  // ---- Data ----
  const big = data.testMoneyAccounts.filter((a) => a.balance > TEST_MONEY_THRESHOLD);
  if (big.length > 0) {
    const sum = big.reduce((s, a) => s + a.balance, 0);
    add("test_money", "Data", "Test money in wallets", "fail", `${big.length} account(s) hold more than ৳${TEST_MONEY_THRESHOLD.toLocaleString()} (total ৳${sum.toLocaleString()}): ${big.map((a) => `${a.name} ৳${a.balance.toLocaleString()}`).join(", ")}. If this is fake test money it could be withdrawn. Clear it with docs/LAUNCH_CLEANUP.md before launch.`);
  } else add("test_money", "Data", "Test money in wallets", "pass", "No account holds a large balance.");
  add("pending_withdrawals", "Data", "Pending withdrawal requests", data.pendingWithdrawals === 0 ? "pass" : "warn", data.pendingWithdrawals === 0 ? "None." : `${data.pendingWithdrawals} request(s) waiting: review them (and reject test ones) before clearing balances.`);
  add("listings", "Data", `Approved listings (target ${LISTING_TARGET}+)`, data.approvedSites >= LISTING_TARGET ? "pass" : "warn", `${data.approvedSites} approved, ${data.verifiedSites} with verified DR.${data.approvedSites >= LISTING_TARGET ? "" : " A thin marketplace makes a weak first impression."}`);
  add("bonus_state", "Data", "Deposit bonus", "pass", data.depositBonusOn ? "ON: confirm the terms (Admin > Deposit bonus) are what you want at launch." : "OFF.");

  // ---- Operations ----
  add("crons", "Operations", "Scheduled jobs", data.cronProblems > 0 ? "fail" : data.cronNever > 0 ? "warn" : "pass", data.cronProblems > 0 ? `${data.cronProblems} job(s) late or failing: see Admin > Operations.` : data.cronNever > 0 ? `${data.cronNever} job(s) have not run yet (normal right after deploy; recheck after a day).` : "All jobs ran on time.");
  add("failed_tasks", "Operations", "Failed background tasks (7 days)", data.failedTasks7d === 0 ? "pass" : "warn", data.failedTasks7d === 0 ? "None." : `${data.failedTasks7d} failed: see Admin > Operations.`);
  return c;
}

export function summarize(checks: Check[]) {
  const fail = checks.filter((x) => x.status === "fail").length;
  const warn = checks.filter((x) => x.status === "warn").length;
  return { fail, warn, pass: checks.length - fail - warn, ready: fail === 0 };
}
