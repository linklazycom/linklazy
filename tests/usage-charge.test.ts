import test from "node:test";
import assert from "node:assert/strict";
import { chargeUsage, refundUsage, isRequestId, type RpcFn } from "@/lib/usage/charge";
import { CHARGING_SETTING_KEY, freeKey, priceKey } from "@/lib/usage/actions";
import { resolveUsagePricing, DEFAULT_PRICING } from "@/lib/usage/pricing";

const USER = { userId: "11111111-1111-4111-8111-111111111111", isAdmin: false };
const ADMIN = { userId: "22222222-2222-4222-8222-222222222222", isAdmin: true };
const KEY = "33333333-3333-4333-8333-333333333333";

const ON = resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 2 }]);
const pricing = (p = ON) => async () => p;

/** A tiny in-memory stand-in for the two database functions, enough to test the TypeScript decisions. */
function fakeDb(opts: { balance: number }) {
  const state = { balance: opts.balance, calls: [] as { fn: string; args: Record<string, unknown> }[], keys: new Set<string>(), charges: new Map<string, { amount: number; status: string }>(), usedFree: 0 };
  let n = 0;
  const rpc: RpcFn = async (fn, args) => {
    state.calls.push({ fn, args });
    if (fn === "usage_charge_debit") {
      const key = String(args.p_key);
      if (state.keys.has(key)) return { data: [{ r_ok: false, r_code: "duplicate", r_message: "dup", r_charge_id: null, r_charged: 0, r_is_free: false }], error: null };
      const amount = Number(args.p_amount);
      if (amount === 0 || state.usedFree < Number(args.p_free_per_day)) {
        state.keys.add(key);
        state.usedFree++;
        const id = `c${++n}`;
        state.charges.set(id, { amount: 0, status: "free" });
        return { data: [{ r_ok: true, r_code: null, r_message: null, r_charge_id: id, r_charged: 0, r_is_free: true }], error: null };
      }
      if (state.balance < amount) return { data: [{ r_ok: false, r_code: "insufficient", r_message: "Not enough", r_charge_id: null, r_charged: 0, r_is_free: false }], error: null };
      state.balance -= amount;
      state.keys.add(key);
      const id = `c${++n}`;
      state.charges.set(id, { amount, status: "charged" });
      return { data: [{ r_ok: true, r_code: null, r_message: null, r_charge_id: id, r_charged: amount, r_is_free: false }], error: null };
    }
    if (fn === "usage_charge_refund") {
      const c = state.charges.get(String(args.p_charge_id));
      if (!c) return { data: [{ r_ok: false, r_message: "Charge not found.", r_refunded: 0 }], error: null };
      if (c.status === "charged") {
        state.balance += c.amount;
        c.status = "refunded";
        return { data: [{ r_ok: true, r_message: null, r_refunded: c.amount }], error: null };
      }
      if (c.status === "free") c.status = "void";
      return { data: [{ r_ok: true, r_message: null, r_refunded: 0 }], error: null };
    }
    return { data: null, error: { message: "unknown function" } };
  };
  return { state, rpc };
}

test("charging off, price 0 and admins never touch the wallet (no database call at all)", async () => {
  const db = fakeDb({ balance: 100 });
  for (const [ctx, p] of [[USER, DEFAULT_PRICING], [ADMIN, ON], [USER, resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }])]] as const) {
    const r = await chargeUsage(ctx, "project_ai_suggest", {}, { rpc: db.rpc, pricing: pricing(p) });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.amount, 0);
      assert.equal(r.free, true);
      assert.equal(r.chargeId, null);
    }
  }
  assert.equal(db.state.calls.length, 0);
  assert.equal(db.state.balance, 100);
});

test("the first uses of the day are free; the next one is charged the SERVER's price", async () => {
  const db = fakeDb({ balance: 10 });
  const deps = { rpc: db.rpc, pricing: pricing() };
  const a = await chargeUsage(USER, "project_ai_suggest", { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, deps);
  const b = await chargeUsage(USER, "project_ai_suggest", { requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, deps);
  const c = await chargeUsage(USER, "project_ai_suggest", { requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", expectedPrice: 4 }, deps);
  assert.ok(a.ok && a.free && a.amount === 0);
  assert.ok(b.ok && b.free);
  assert.ok(c.ok && !c.free && c.amount === 4);
  assert.equal(db.state.balance, 6);
  const debit = db.state.calls.filter((x) => x.fn === "usage_charge_debit").at(-1)!;
  assert.equal(debit.args.p_amount, 4);
  assert.equal(debit.args.p_user_id, USER.userId);
  assert.equal(debit.args.p_action, "project_ai_suggest");
  assert.equal(debit.args.p_free_per_day, 2);
});

test("a client cannot pay less: a lower expected price is refused with the real price", async () => {
  const db = fakeDb({ balance: 100 });
  const r = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY, expectedPrice: 1 }, { rpc: db.rpc, pricing: pricing() });
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.status, 409);
    assert.equal(r.code, "price_changed");
    assert.equal(r.price, 4);
  }
  assert.equal(db.state.calls.length, 0);
  assert.equal(db.state.balance, 100);
  // paying MORE than the displayed price never happens: a higher expected price is simply the real price
  const ok = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY, expectedPrice: 50 }, { rpc: db.rpc, pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])) });
  assert.ok(ok.ok && ok.amount === 4);
});

test("the same request id is never charged twice", async () => {
  const db = fakeDb({ balance: 20 });
  const deps = { rpc: db.rpc, pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])) };
  const first = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, deps);
  const second = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, deps);
  assert.ok(first.ok);
  assert.ok(!second.ok);
  if (!second.ok) {
    assert.equal(second.status, 409);
    assert.equal(second.code, "duplicate");
  }
  assert.equal(db.state.balance, 16);
});

test("not enough balance: refused with 402 and the price, nothing taken", async () => {
  const db = fakeDb({ balance: 3 });
  const deps = { rpc: db.rpc, pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])) };
  const r = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, deps);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.status, 402);
    assert.equal(r.code, "insufficient");
    assert.equal(r.price, 4);
    assert.ok(r.error.includes("৳4"));
  }
  assert.equal(db.state.balance, 3);
});

test("a malformed request id is refused before any database call", async () => {
  const db = fakeDb({ balance: 50 });
  const r = await chargeUsage(USER, "project_ai_suggest", { requestId: "not-a-uuid" }, { rpc: db.rpc, pricing: pricing() });
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.status, 400);
  assert.equal(db.state.calls.length, 0);
  assert.ok(isRequestId(KEY));
  assert.ok(!isRequestId("../../etc"));
});

test("without a request id a random key is generated (still one charge per call)", async () => {
  const db = fakeDb({ balance: 50 });
  let i = 0;
  const deps = { rpc: db.rpc, pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])), newKey: () => `generated-key-${++i}` };
  await chargeUsage(USER, "project_ai_suggest", {}, deps);
  await chargeUsage(USER, "project_ai_suggest", {}, deps);
  assert.deepEqual(db.state.calls.map((c) => c.args.p_key), ["generated-key-1", "generated-key-2"]);
  assert.equal(db.state.balance, 42);
});

test("database errors become a safe message and never claim a charge happened", async () => {
  const deps = { pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])) };
  const down = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, { ...deps, rpc: async () => ({ data: null, error: { message: "connection lost: secret details" } }) });
  assert.ok(!down.ok);
  if (!down.ok) {
    assert.equal(down.status, 500);
    assert.ok(down.error.includes("not charged"));
    assert.ok(!down.error.includes("secret"));
  }
  const thrown = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, { ...deps, rpc: async () => { throw new Error("boom"); } });
  assert.ok(!thrown.ok);
  const empty = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, { ...deps, rpc: async () => ({ data: [], error: null }) });
  assert.ok(!empty.ok);
  const weird = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, { ...deps, rpc: async () => ({ data: [{ r_ok: false, r_code: "failed", r_message: "internal: leaked detail", r_charge_id: null, r_charged: 0, r_is_free: false }], error: null }) });
  assert.ok(!weird.ok);
  if (!weird.ok) assert.ok(!weird.error.includes("leaked"));
});

test("refund gives the money back once; refunding twice or a free use takes/gives nothing more", async () => {
  const db = fakeDb({ balance: 20 });
  const deps = { rpc: db.rpc, pricing: pricing(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 0 }])) };
  const c = await chargeUsage(USER, "project_ai_suggest", { requestId: KEY }, deps);
  assert.ok(c.ok && c.chargeId);
  assert.equal(db.state.balance, 16);
  assert.equal(await refundUsage(c.ok ? c.chargeId : null, "ai failed", { rpc: db.rpc }), true);
  assert.equal(db.state.balance, 20);
  assert.equal(await refundUsage(c.ok ? c.chargeId : null, "again", { rpc: db.rpc }), true);
  assert.equal(db.state.balance, 20);
});

test("refundUsage: nothing to refund is fine; a failing refund is reported (never silently true)", async () => {
  assert.equal(await refundUsage(null, "x"), true);
  const bad = await refundUsage("c1", "x", { rpc: async () => ({ data: null, error: { message: "db down" } }) });
  assert.equal(bad, false);
  const refused = await refundUsage("c1", "x", { rpc: async () => ({ data: [{ r_ok: false, r_message: "Could not refund.", r_refunded: 0 }], error: null }) });
  assert.equal(refused, false);
  const threw = await refundUsage("c1", "x", { rpc: async () => { throw new Error("net"); } });
  assert.equal(threw, false);
});
