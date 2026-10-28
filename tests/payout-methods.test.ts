import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBdMobile, validatePayout, payoutSummary, payoutAccount, validatePaidProof, maskAccount } from "../lib/payout-methods.ts";
import { buildWithdrawalEmail } from "../lib/withdrawal-email.ts";

test("payout: bd mobile numbers are normalized", () => {
  assert.equal(normalizeBdMobile("01712345678"), "01712345678");
  assert.equal(normalizeBdMobile("+880 1712-345678"), "01712345678");
  assert.equal(normalizeBdMobile("8801912345678"), "01912345678");
  assert.equal(normalizeBdMobile("0121234567"), null);
  assert.equal(normalizeBdMobile("abc"), null);
});

test("payout: bkash and nagad need a valid number", () => {
  const ok = validatePayout({ method: "nagad", account_number: "+8801812345678" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.account_number, "01812345678");
  assert.equal(validatePayout({ method: "bkash", account_number: "123" }).ok, false);
  assert.equal(validatePayout({ method: "paypal", account_number: "01712345678" }).ok, false);
  assert.equal(validatePayout({ account_number: "01712345678" }).ok, true); // default bkash
});

test("payout: bank needs holder, bank and account; routing is 9 digits", () => {
  const base = { method: "bank", account_number: "1234 5678 90", account_name: "A Rahman", bank_name: "City Bank" };
  assert.equal(validatePayout(base).ok, true);
  assert.equal(validatePayout({ ...base, account_name: "" }).ok, false);
  assert.equal(validatePayout({ ...base, bank_name: "" }).ok, false);
  assert.equal(validatePayout({ ...base, routing_number: "123" }).ok, false);
  assert.equal(validatePayout({ ...base, routing_number: "123456789" }).ok, true);
});

test("payout: summary and legacy rows", () => {
  assert.equal(payoutAccount({ bkash_number: "01712345678" }), "01712345678");
  assert.equal(payoutSummary({ bkash_number: "01712345678" }), "bKash 01712345678");
  const bank = { method: "bank", account_number: "1234567890", bank_name: "City Bank", account_name: "A Rahman" };
  assert.match(payoutSummary(bank, { mask: true }), /\*+7890/);
  assert.equal(maskAccount("12"), "12");
});

test("payout: paid needs a transaction id and an https proof", () => {
  assert.equal(validatePaidProof({ transaction_id: "" }).ok, false);
  assert.equal(validatePaidProof({ transaction_id: "ab" }).ok, false);
  assert.equal(validatePaidProof({ transaction_id: "BK12345X" }).ok, true);
  assert.equal(validatePaidProof({ transaction_id: "BK12345X", proof_url: "http://x.com/a" }).ok, false);
  assert.equal(validatePaidProof({ transaction_id: "BK12345X", proof_url: "javascript:alert(1)" }).ok, false);
  assert.equal(validatePaidProof({ transaction_id: "BK12345X", proof_url: "https://x.com/a.png" }).ok, true);
});

test("withdrawal email: escapes text and masks the account", () => {
  const mail = buildWithdrawalEmail({
    status: "paid",
    amount: 1500,
    method: "bank",
    account_number: "1234567890",
    transaction_id: "<b>T1</b>",
    siteUrl: "https://linklazy.com",
  });
  assert.match(mail.subject, /1,500/);
  assert.ok(!mail.html.includes("<b>T1"));
  assert.ok(!mail.html.includes("1234567890"));
  const rej = buildWithdrawalEmail({ status: "rejected", amount: 100, admin_note: "Wrong number", siteUrl: "https://linklazy.com" });
  assert.match(rej.html, /Wrong number/);
});
