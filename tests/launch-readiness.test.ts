import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLaunchReadiness, summarize, type LaunchInput } from "../lib/launch-readiness.ts";

const goodEnv = {
  PAYPAL_CLIENT_ID: "x", PAYPAL_CLIENT_SECRET: "y", PAYPAL_BASE_URL: "https://api-m.paypal.com", PAYPAL_WEBHOOK_ID: "w",
  BKASH_BASE_URL: "https://tokenized.pay.bka.sh/v1.2.0-beta", NEXT_PUBLIC_SITE_URL: "https://linklazy.com",
  RESEND_API_KEY: "r", EMAIL_FROM: "LinkLazy <no-reply@linklazy.com>", CRON_SECRET: "c", SUPABASE_SERVICE_ROLE_KEY: "s",
  LINK_HASH_SECRET: "0123456789abcdef", OPENAI_API_KEY: "o",
};
const goodData = { approvedSites: 150, verifiedSites: 120, testMoneyAccounts: [], pendingWithdrawals: 0, failedTasks7d: 0, cronProblems: 0, cronNever: 0, depositBonusOn: false, signupOpen: true };
const run = (over: Partial<LaunchInput["env"]> = {}, data: Partial<LaunchInput["data"]> = {}) => evaluateLaunchReadiness({ env: { ...goodEnv, ...over }, data: { ...goodData, ...data } });
const status = (checks: ReturnType<typeof run>, id: string) => checks.find((c) => c.id === id)!.status;

test("launch: a fully ready setup has no failures or warnings", () => {
  const s = summarize(run());
  assert.equal(s.fail, 0);
  assert.equal(s.warn, 0);
  assert.equal(s.ready, true);
});

test("launch: sandbox payment URLs block launch", () => {
  assert.equal(status(run({ PAYPAL_BASE_URL: "https://api-m.sandbox.paypal.com" }), "paypal_live"), "fail");
  assert.equal(status(run({ BKASH_BASE_URL: "https://tokenized.sandbox.bka.sh/v1.2.0-beta" }), "bkash_live"), "fail");
  assert.equal(status(run({ BKASH_BASE_URL: undefined }), "bkash_live"), "warn");
});

test("launch: site url, email and secrets", () => {
  assert.equal(status(run({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), "site_url"), "fail");
  assert.equal(status(run({ NEXT_PUBLIC_SITE_URL: "https://linklazy.vercel.app" }), "site_url"), "warn");
  assert.equal(status(run({ RESEND_API_KEY: undefined }), "resend"), "fail");
  assert.equal(status(run({ CRON_SECRET: "" }), "cron_secret"), "fail");
  assert.equal(status(run({ PAYPAL_WEBHOOK_ID: undefined }), "paypal_webhook"), "warn");
  assert.equal(status(run({ LINK_HASH_SECRET: undefined, PROVIDER_KEY_ENCRYPTION_SECRET: undefined }), "hash_secret"), "warn");
});

test("launch: large wallet balances are flagged as possible test money", () => {
  const checks = run({}, { testMoneyAccounts: [{ name: "Admin", balance: 500000 }, { name: "David", balance: 25000 }, { name: "Small", balance: 500 }] });
  assert.equal(status(checks, "test_money"), "fail");
  const detail = checks.find((c) => c.id === "test_money")!.detail;
  assert.match(detail, /2 account/);
  assert.ok(detail.includes("Admin") && !detail.includes("Small"));
  assert.equal(summarize(checks).ready, false);
});

test("launch: few listings, cron problems, closed signups are warnings or failures as appropriate", () => {
  assert.equal(status(run({}, { approvedSites: 12 }), "listings"), "warn");
  assert.equal(status(run({}, { cronProblems: 2 }), "crons"), "fail");
  assert.equal(status(run({}, { cronNever: 3 }), "crons"), "warn");
  assert.equal(status(run({}, { signupOpen: false }), "signup"), "warn");
  assert.equal(status(run({}, { pendingWithdrawals: 2 }), "pending_withdrawals"), "warn");
});
