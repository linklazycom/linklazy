import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, planWithdrawal, referralAvailable } from "../lib/withdrawal-flow.ts";

test("withdrawal: allowed transitions", () => {
  assert.equal(canTransition("pending", "approved"), true);
  assert.equal(canTransition("pending", "rejected"), true);
  assert.equal(canTransition("approved", "paid"), true);
  assert.equal(canTransition("approved", "rejected"), true);
});

test("withdrawal: final states cannot move", () => {
  assert.equal(canTransition("rejected", "approved"), false);
  assert.equal(canTransition("rejected", "paid"), false);
  assert.equal(canTransition("paid", "rejected"), false);
  assert.equal(canTransition("pending", "paid"), false);
  assert.equal(canTransition("unknown", "paid"), false);
});

test("withdrawal: the wallet part is not subtracted twice", () => {
  // 1000 in the wallet, 500 referral credits; a 1000 request was taken fully from the wallet.
  const locked = [{ amount: 1000, status: "pending", wallet_reserved: 1000 }];
  assert.equal(referralAvailable(500, locked), 500);
  // wallet now 0, so the user can still withdraw the 500 referral credits
  assert.deepEqual(planWithdrawal(500, 0, 500), { ok: true, fromWallet: 0, fromReferral: 500 });
});

test("withdrawal: old requests without wallet_reserved keep the old behaviour", () => {
  const locked = [{ amount: 300, status: "paid", wallet_reserved: null }];
  assert.equal(referralAvailable(1000, locked), 700);
});

test("withdrawal: rejected requests free the referral part", () => {
  const locked = [{ amount: 300, status: "rejected", wallet_reserved: 0 }];
  assert.equal(referralAvailable(1000, locked), 1000);
});

test("withdrawal: wallet is used first, rest comes from referral credits", () => {
  assert.deepEqual(planWithdrawal(800, 500, 400), { ok: true, fromWallet: 500, fromReferral: 300 });
});

test("withdrawal: too much is refused with the real maximum", () => {
  assert.deepEqual(planWithdrawal(1000, 300, 200), { ok: false, available: 500 });
  assert.equal(planWithdrawal(0, 300, 200).ok, false);
  assert.equal(planWithdrawal(-5, 300, 200).ok, false);
});
