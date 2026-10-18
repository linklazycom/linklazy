import test from "node:test";
import assert from "node:assert/strict";
import { USAGE_ACTIONS, isUsageAction, priceKey, freeKey, CHARGING_SETTING_KEY, MAX_USAGE_PRICE, MAX_FREE_PER_DAY } from "@/lib/usage/actions";
import { DEFAULT_PRICING, USAGE_SETTING_KEYS, buildPricingRows, buildQuote, decideCharge, resolveUsagePricing } from "@/lib/usage/pricing";

test("defaults: charging is OFF and everything is free", () => {
  assert.equal(DEFAULT_PRICING.enabled, false);
  for (const a of USAGE_ACTIONS) {
    assert.equal(DEFAULT_PRICING.actions[a.id].price, 0);
    assert.equal(decideCharge(DEFAULT_PRICING, a.id).charge, false);
  }
  assert.equal(resolveUsagePricing([]).enabled, false);
  assert.equal(resolveUsagePricing(null).enabled, false);
});

test("resolveUsagePricing: reads numbers, numeric strings and booleans; junk falls back to defaults", () => {
  const p = resolveUsagePricing([
    { key: CHARGING_SETTING_KEY, value: 1 },
    { key: priceKey("project_ai_suggest"), value: "3" },
    { key: freeKey("project_ai_suggest"), value: '"7"' },
    { key: priceKey("backlink_extra_check"), value: 2.5 }, // not a whole number: ignored
    { key: freeKey("backlink_extra_check"), value: -1 }, // out of range: ignored
    { key: "unrelated_setting", value: 99 },
  ]);
  assert.equal(p.enabled, true);
  assert.equal(p.actions.project_ai_suggest.price, 3);
  assert.equal(p.actions.project_ai_suggest.freePerDay, 7);
  assert.equal(p.actions.backlink_extra_check.price, 0);
  assert.equal(p.actions.backlink_extra_check.freePerDay, 0);
});

test("resolveUsagePricing: out-of-range and junk values never switch charging on or set prices", () => {
  const p = resolveUsagePricing([
    { key: CHARGING_SETTING_KEY, value: 2 },
    { key: priceKey("project_ai_suggest"), value: MAX_USAGE_PRICE + 1 },
    { key: freeKey("project_ai_suggest"), value: MAX_FREE_PER_DAY + 1 },
  ]);
  assert.equal(p.enabled, false);
  assert.equal(p.actions.project_ai_suggest.price, 0);
  assert.equal(p.actions.project_ai_suggest.freePerDay, 5);
  assert.equal(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: "maybe" }]).enabled, false);
  assert.equal(resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: null }]).enabled, false);
});

test("resolveUsagePricing does not mutate the shared defaults", () => {
  resolveUsagePricing([{ key: priceKey("project_ai_suggest"), value: 9 }, { key: CHARGING_SETTING_KEY, value: 1 }]);
  assert.equal(DEFAULT_PRICING.actions.project_ai_suggest.price, 0);
  assert.equal(DEFAULT_PRICING.enabled, false);
});

test("decideCharge: charges only when the switch is on AND the price is above 0", () => {
  const on = resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }]);
  assert.deepEqual(decideCharge(on, "project_ai_suggest"), { charge: true, price: 4, freePerDay: 5 });
  assert.equal(decideCharge(on, "backlink_extra_check").charge, false); // price 0
  const off = resolveUsagePricing([{ key: priceKey("project_ai_suggest"), value: 4 }]); // price set but switch off
  assert.equal(decideCharge(off, "project_ai_suggest").charge, false);
});

test("buildPricingRows: whole numbers in range only; the switch must be a boolean", () => {
  const prices = Object.fromEntries(USAGE_ACTIONS.map((a) => [a.id, 3]));
  const free = Object.fromEntries(USAGE_ACTIONS.map((a) => [a.id, 2]));
  const ok = buildPricingRows({ enabled: true, prices, freePerDay: free });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.rows.length, 1 + USAGE_ACTIONS.length * 2);
    assert.deepEqual(ok.rows[0], { key: CHARGING_SETTING_KEY, value: 1 });
    assert.deepEqual(new Set(ok.rows.map((r) => r.key)), new Set(USAGE_SETTING_KEYS));
  }
  assert.equal(buildPricingRows({ enabled: "yes", prices, freePerDay: free }).ok, false);
  assert.equal(buildPricingRows({ enabled: true, prices: { ...prices, project_ai_suggest: 1.5 }, freePerDay: free }).ok, false);
  assert.equal(buildPricingRows({ enabled: true, prices: { ...prices, project_ai_suggest: -1 }, freePerDay: free }).ok, false);
  assert.equal(buildPricingRows({ enabled: true, prices: { ...prices, project_ai_suggest: MAX_USAGE_PRICE + 1 }, freePerDay: free }).ok, false);
  assert.equal(buildPricingRows({ enabled: true, prices, freePerDay: { ...free, backlink_extra_check: MAX_FREE_PER_DAY + 1 } }).ok, false);
  assert.equal(buildPricingRows({ enabled: false, prices: {}, freePerDay: {} }).ok, false); // a missing action is an error, not a silent 0
  assert.equal(buildPricingRows({ enabled: true, prices: { ...prices, project_ai_suggest: "3" as unknown as number }, freePerDay: free }).ok, false);
});

test("buildQuote: shows free uses left, then the price; admin-set values only", () => {
  const p = resolveUsagePricing([{ key: CHARGING_SETTING_KEY, value: 1 }, { key: priceKey("project_ai_suggest"), value: 4 }, { key: freeKey("project_ai_suggest"), value: 3 }]);
  const a = buildQuote(p, "project_ai_suggest", 1, 50);
  assert.deepEqual(a, { charging: true, price: 4, freePerDay: 3, freeLeftToday: 2, nextUseCosts: false, balance: 50 });
  const b = buildQuote(p, "project_ai_suggest", 3, 10);
  assert.equal(b.freeLeftToday, 0);
  assert.equal(b.nextUseCosts, true);
  assert.equal(buildQuote(p, "project_ai_suggest", 99, null).freeLeftToday, 0); // never negative
  const free = buildQuote(DEFAULT_PRICING, "project_ai_suggest", 0, 5);
  assert.equal(free.charging, false);
  assert.equal(free.nextUseCosts, false);
});

test("isUsageAction", () => {
  assert.ok(isUsageAction("project_ai_suggest"));
  assert.ok(!isUsageAction("drop table"));
  assert.ok(!isUsageAction(undefined));
});
