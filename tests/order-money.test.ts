import test from "node:test";
import assert from "node:assert/strict";
import { computeCommission, refundOrderToBuyer, releaseOrderToSeller } from "../lib/order-money.ts";

/**
 * Tiny chainable fake of the Supabase client. Every query method returns the same
 * chain; awaiting it resolves to results["<table>:<first method>"].
 */
function fakeClient(
  results: Record<string, unknown>,
  rpcResult: { error: { message: string } | null } | { error: { message: string } | null }[] = { error: null }
) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      let op = "";
      const chain: any = new Proxy(function () {}, {
        get(_t, prop: string) {
          if (prop === "then") {
            const r = results[`${table}:${op}`] ?? { data: null, error: null };
            return (resolve: (v: unknown) => void) => resolve(r);
          }
          return (...args: unknown[]) => {
            if (!op) op = prop;
            if (prop === "update" || prop === "insert") calls.push({ table, op: prop, args });
            return chain;
          };
        },
      });
      return chain;
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Array.isArray(rpcResult) ? (rpcResult[rpcCalls.length - 1] ?? { error: null }) : rpcResult;
    },
  };
  return { client: client as any, calls, rpcCalls };
}

const order = {
  id: "o1",
  order_type: "paid",
  price_amount: 1950,
  buyer_id: "buyer",
  seller_id: "seller",
  site_id: "site",
};

test("commission: a small order (1950 BDT at 125 BDT/USD) is charged 20%", () => {
  const r = computeCommission(0, 1950, 125);
  assert.equal(r.rate, 20);
  assert.equal(r.commissionAmount, 390);
  assert.equal(r.sellerEarning, 1560);
});

test("commission: tiers follow the monthly USD total", () => {
  assert.equal(computeCommission(60000, 1950, 125).rate, 20); // about 495 USD
  assert.equal(computeCommission(62500, 1950, 125).rate, 15); // about 515 USD
  assert.equal(computeCommission(124000, 1950, 125).rate, 10); // about 1008 USD
});

test("release: pays seller price minus commission and records the rate", async () => {
  const { client, calls, rpcCalls } = fakeClient({
    "payments:select": { data: [{ id: "p1" }], error: null },
    "orders:select": { data: [], error: null },
    "site_settings:select": { data: { value: "125" }, error: null },
  });
  const res = await releaseOrderToSeller(client, order);
  assert.deepEqual(res, { ok: true });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_delta, 1560);
  assert.equal(rpcCalls[0].args.p_type, "seller_earning");
  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assert.deepEqual(orderUpdate?.args[0], { commission_rate: 20, commission_amount: 390 });
});

test("release: refuses when no escrow payment is held", async () => {
  const { client, rpcCalls } = fakeClient({ "payments:select": { data: [], error: null } });
  const res = await releaseOrderToSeller(client, order);
  assert.equal(res.ok, false);
  assert.equal(rpcCalls.length, 0);
});

test("release: exchange orders move no money", async () => {
  const { client, rpcCalls } = fakeClient({});
  const res = await releaseOrderToSeller(client, { ...order, order_type: "exchange", price_amount: null });
  assert.deepEqual(res, { ok: true });
  assert.equal(rpcCalls.length, 0);
});

test("refund: wallet payment goes back with a refund type, never topup", async () => {
  const { client, rpcCalls } = fakeClient({
    "payments:update": { data: [{ id: "p1", provider: "wallet", amount: 1950 }], error: null },
  });
  const res = await refundOrderToBuyer(client, order, "test");
  assert.deepEqual(res, { ok: true, manualProviderRefund: false });
  assert.equal(rpcCalls[0].args.p_delta, 1950);
  assert.equal(rpcCalls[0].args.p_user_id, "buyer");
  assert.equal(rpcCalls[0].args.p_type, "order_refund");
  assert.equal(rpcCalls.length, 1);
});

test("refund: if the ledger rejects the refund type, it retries once with the fallback type", async () => {
  const { client, rpcCalls } = fakeClient(
    { "payments:update": { data: [{ id: "p1", provider: "wallet", amount: 1950 }], error: null } },
    [{ error: { message: "violates check constraint" } }, { error: null }]
  );
  const res = await refundOrderToBuyer(client, order, "test");
  assert.deepEqual(res, { ok: true, manualProviderRefund: false });
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[0].args.p_type, "order_refund");
  assert.equal(rpcCalls[1].args.p_type, "admin_adjustment");
  assert.equal(rpcCalls[1].args.p_delta, 1950);
});

test("refund: provider payments are only marked, admin must refund them", async () => {
  const { client, rpcCalls } = fakeClient({
    "payments:update": { data: [{ id: "p1", provider: "bkash", amount: 1950 }], error: null },
  });
  const res = await refundOrderToBuyer(client, order, "test");
  assert.deepEqual(res, { ok: true, manualProviderRefund: true });
  assert.equal(rpcCalls.length, 0);
});

test("refund: a failed credit puts the payment back to held_escrow", async () => {
  const { client, calls } = fakeClient(
    { "payments:update": { data: [{ id: "p1", provider: "wallet", amount: 1950 }], error: null } },
    [{ error: { message: "boom" } }, { error: { message: "boom" } }]
  );
  const res = await refundOrderToBuyer(client, order, "test");
  assert.equal(res.ok, false);
  const updates = calls.filter((c) => c.table === "payments" && c.op === "update");
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1].args[0], { status: "held_escrow" });
});

test("refund: nothing held means nothing to refund", async () => {
  const { client, rpcCalls } = fakeClient({ "payments:update": { data: [], error: null } });
  const res = await refundOrderToBuyer(client, order, "test");
  assert.deepEqual(res, { ok: true });
  assert.equal(rpcCalls.length, 0);
});
