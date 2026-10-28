import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BONUS, clawbackAmount, computeBonus, resolveBonusSettings, validateBonusInput, withdrawableWallet } from "../lib/deposit-bonus.ts";
import { captureCoversPayment, parseCaptureCompleted } from "../lib/paypal/events.ts";

test("bonus: off by default and below the minimum", () => {
  assert.equal(computeBonus(5000, DEFAULT_BONUS), 0);
  const on = { enabled: true, minAmount: 500, percent: 10, maxBonus: 300 };
  assert.equal(computeBonus(499, on), 0);
  assert.equal(computeBonus(500, on), 50);
  assert.equal(computeBonus(1234, on), 123);
});

test("bonus: capped and whole numbers", () => {
  const on = { enabled: true, minAmount: 100, percent: 10, maxBonus: 300 };
  assert.equal(computeBonus(50000, on), 300);
  assert.equal(computeBonus(Number.NaN, on), 0);
});

test("bonus: settings rows resolve over safe defaults, junk is ignored", () => {
  const s = resolveBonusSettings([
    { key: "deposit_bonus_enabled", value: 1 },
    { key: "deposit_bonus_percent", value: "15" },
    { key: "deposit_bonus_min_amount", value: 10 }, // below 50 -> ignored
    { key: "deposit_bonus_max_amount", value: "abc" },
  ]);
  assert.deepEqual(s, { enabled: true, minAmount: DEFAULT_BONUS.minAmount, percent: 15, maxBonus: DEFAULT_BONUS.maxBonus });
});

test("bonus: admin input is validated", () => {
  assert.equal(validateBonusInput({ enabled: true, minAmount: 500, percent: 5, maxBonus: 200 }).ok, true);
  assert.equal(validateBonusInput({ enabled: "yes", minAmount: 500, percent: 5, maxBonus: 200 }).ok, false);
  assert.equal(validateBonusInput({ enabled: true, minAmount: 500, percent: 0, maxBonus: 200 }).ok, false);
  assert.equal(validateBonusInput({ enabled: true, minAmount: 500, percent: 101, maxBonus: 200 }).ok, false);
  assert.equal(validateBonusInput({ enabled: true, minAmount: 10, percent: 5, maxBonus: 200 }).ok, false);
  assert.equal(validateBonusInput({ enabled: true, minAmount: 500, percent: 5.5, maxBonus: 200 }).ok, false);
});

test("bonus: unspent bonus is not withdrawable; clawback never exceeds balance or remaining", () => {
  assert.equal(withdrawableWallet(1100, 100), 1000);
  assert.equal(withdrawableWallet(50, 100), 0);
  assert.equal(clawbackAmount(100, 40), 40);
  assert.equal(clawbackAmount(30, 500), 30);
  assert.equal(clawbackAmount(-5, 500), 0);
});

const goodEvent = {
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: { status: "COMPLETED", amount: { value: "8.00", currency_code: "USD" }, supplementary_data: { related_ids: { order_id: "5O190127TN364715T" } } },
};

test("paypal events: only a completed USD capture is understood", () => {
  const c = parseCaptureCompleted(goodEvent);
  assert.deepEqual(c, { paypalOrderId: "5O190127TN364715T", usd: 8, currency: "USD" });
  assert.equal(parseCaptureCompleted({ ...goodEvent, event_type: "PAYMENT.CAPTURE.DENIED" }), null);
  assert.equal(parseCaptureCompleted({ ...goodEvent, resource: { ...goodEvent.resource, status: "PENDING" } }), null);
  assert.equal(parseCaptureCompleted({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }), null);
  assert.equal(parseCaptureCompleted(null), null);
});

test("paypal events: amount must cover the payment and be USD", () => {
  const c = parseCaptureCompleted(goodEvent)!;
  assert.equal(captureCoversPayment(c, 8), true);
  assert.equal(captureCoversPayment(c, 8.005), true);
  assert.equal(captureCoversPayment(c, 8.5), false);
  assert.equal(captureCoversPayment({ ...c, currency: "EUR" }, 8), false);
});
