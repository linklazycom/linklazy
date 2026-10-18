import {
  CHARGING_SETTING_KEY,
  MAX_FREE_PER_DAY,
  MAX_USAGE_PRICE,
  USAGE_ACTIONS,
  freeKey,
  priceKey,
  type UsageActionId,
} from "@/lib/usage/actions";

/** Pure pricing rules for usage charges (Batch 14). Tested in tests/usage-pricing.test.ts. */
export interface ActionPricing {
  price: number; // whole wallet units; 0 = free
  freePerDay: number; // uses per UTC day that cost nothing
}

export interface UsagePricing {
  enabled: boolean;
  actions: Record<UsageActionId, ActionPricing>;
}

export const DEFAULT_PRICING: UsagePricing = {
  enabled: false,
  actions: Object.fromEntries(USAGE_ACTIONS.map((a) => [a.id, { price: 0, freePerDay: a.defaultFreePerDay }])) as Record<UsageActionId, ActionPricing>,
};

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Number.isInteger(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim().replace(/^"+|"+$/g, "");
    if (/^-?\d+$/.test(t)) return Number(t);
    if (t === "true") return 1;
    if (t === "false") return 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}

/** Merges stored setting rows over the safe defaults. Junk or out-of-range values fall back to the default. */
export function resolveUsagePricing(rows: { key: string; value: unknown }[] | null | undefined): UsagePricing {
  const out: UsagePricing = { enabled: DEFAULT_PRICING.enabled, actions: Object.fromEntries(Object.entries(DEFAULT_PRICING.actions).map(([k, v]) => [k, { ...v }])) as UsagePricing["actions"] };
  for (const row of rows ?? []) {
    const n = toInt(row.value);
    if (n === null) continue;
    if (row.key === CHARGING_SETTING_KEY) {
      if (n === 0 || n === 1) out.enabled = n === 1;
      continue;
    }
    for (const a of USAGE_ACTIONS) {
      if (row.key === priceKey(a.id) && n >= 0 && n <= MAX_USAGE_PRICE) out.actions[a.id].price = n;
      if (row.key === freeKey(a.id) && n >= 0 && n <= MAX_FREE_PER_DAY) out.actions[a.id].freePerDay = n;
    }
  }
  return out;
}

export const USAGE_SETTING_KEYS: string[] = [CHARGING_SETTING_KEY, ...USAGE_ACTIONS.flatMap((a) => [priceKey(a.id), freeKey(a.id)])];

export interface ChargeDecision {
  /** true only when charging is on AND this action has a price. */
  charge: boolean;
  price: number;
  freePerDay: number;
}

export function decideCharge(pricing: UsagePricing, action: UsageActionId): ChargeDecision {
  const a = pricing.actions[action];
  return { charge: pricing.enabled && a.price > 0, price: a.price, freePerDay: a.freePerDay };
}

export interface AdminPricingInput {
  enabled?: unknown;
  prices?: Record<string, unknown>;
  freePerDay?: Record<string, unknown>;
}

/** Validates what an admin submitted and turns it into setting rows. Whole numbers only; ranges enforced. */
export function buildPricingRows(input: AdminPricingInput): { ok: true; rows: { key: string; value: number }[] } | { ok: false; error: string } {
  const rows: { key: string; value: number }[] = [];
  if (typeof input.enabled !== "boolean") return { ok: false, error: "Choose whether charging is on or off." };
  rows.push({ key: CHARGING_SETTING_KEY, value: input.enabled ? 1 : 0 });
  for (const a of USAGE_ACTIONS) {
    const price = input.prices?.[a.id];
    const free = input.freePerDay?.[a.id];
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0 || price > MAX_USAGE_PRICE) {
      return { ok: false, error: `"${a.label}": the price must be a whole number from 0 to ${MAX_USAGE_PRICE}.` };
    }
    if (typeof free !== "number" || !Number.isInteger(free) || free < 0 || free > MAX_FREE_PER_DAY) {
      return { ok: false, error: `"${a.label}": free uses per day must be a whole number from 0 to ${MAX_FREE_PER_DAY}.` };
    }
    rows.push({ key: priceKey(a.id), value: price }, { key: freeKey(a.id), value: free });
  }
  return { ok: true, rows };
}

export interface UsageQuote {
  /** Charging applies to this action (switch on and price > 0). */
  charging: boolean;
  price: number;
  freePerDay: number;
  freeLeftToday: number;
  /** The next use costs money (charging on, price > 0, free allowance used up). */
  nextUseCosts: boolean;
  balance: number | null;
}

export function buildQuote(pricing: UsagePricing, action: UsageActionId, usedToday: number, balance: number | null): UsageQuote {
  const d = decideCharge(pricing, action);
  const freeLeftToday = Math.max(0, d.freePerDay - usedToday);
  return { charging: d.charge, price: d.price, freePerDay: d.freePerDay, freeLeftToday, nextUseCosts: d.charge && freeLeftToday === 0, balance };
}
