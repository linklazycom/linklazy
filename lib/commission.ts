/**
 * Commission is tiered by each seller's cumulative RELEASED sales total
 * within the current calendar month (not per-order, not signup plan) —
 * and the tier thresholds are defined in USD, not in the platform's
 * storage currency (৳/BDT).
 *
 * Brackets (inclusive of the cumulative USD total *after* adding this
 * order):
 *   $0    – $499.99  -> 20%
 *   $500  – $999.99  -> 15%
 *   $1000+           -> 10%
 *
 * order.price_amount (and every other stored money amount) is in ৳, so
 * anywhere this cumulative total is computed, it must be converted to USD
 * with the live bdt_per_usd rate (see lib/exchange-rate.ts) before being
 * compared against these thresholds — comparing raw ৳ figures against
 * 500/1000 would push sellers into the lower rates almost immediately,
 * since ৳500 is only a few US dollars.
 *
 * The rate is finalized once, at escrow-release time (buyer accepts
 * delivery), using whatever bracket the seller's month-to-date USD total
 * lands in at that moment (converted using the exchange rate at that same
 * moment). Orders placed earlier in the month are not retroactively
 * re-priced when the seller crosses a threshold later — each order's
 * commission is locked in when *that* order is released.
 *
 * COMMISSION_TIERS is the single source of truth — both the pricing logic
 * below and the seller-facing "commission tier" dashboard widget read
 * from it, so the two can never drift out of sync.
 */
export const COMMISSION_TIERS = [
  { minUsd: 0, rate: 20 },
  { minUsd: 500, rate: 15 },
  { minUsd: 1000, rate: 10 },
] as const;

export function commissionRateForCumulativeUsd(cumulativeUsdAfterThisOrder: number): number {
  let rate: number = COMMISSION_TIERS[0].rate;
  for (const tier of COMMISSION_TIERS) {
    if (cumulativeUsdAfterThisOrder >= tier.minUsd) rate = tier.rate;
  }
  return rate;
}

/** Where a seller currently sits across the tiers, and what it'd take to
 * reach the next one — powers the dashboard "commission tier" widget.
 * Takes the seller's month-to-date total in ৳ (as stored) plus the live
 * exchange rate, and does the USD conversion internally so callers never
 * have to remember to do it themselves. */
export function commissionTierProgress(cumulativeThisMonthBdt: number, bdtPerUsd: number) {
  const cumulativeThisMonthUsd = cumulativeThisMonthBdt / bdtPerUsd;

  const currentIndex = [...COMMISSION_TIERS]
    .reverse()
    .findIndex((t) => cumulativeThisMonthUsd >= t.minUsd);
  const resolvedIndex = COMMISSION_TIERS.length - 1 - currentIndex;
  const current = COMMISSION_TIERS[resolvedIndex];
  const next = COMMISSION_TIERS[resolvedIndex + 1] ?? null;

  const amountToNextTierUsd = next ? Math.max(0, next.minUsd - cumulativeThisMonthUsd) : 0;

  return {
    tiers: COMMISSION_TIERS,
    currentIndex: resolvedIndex,
    currentRate: current.rate,
    cumulativeThisMonthBdt,
    cumulativeThisMonthUsd,
    bdtPerUsd,
    nextTier: next,
    amountToNextTierUsd,
    amountToNextTierBdt: Math.max(0, Math.round(amountToNextTierUsd * bdtPerUsd)),
    isTopTier: next === null,
  };
}

/** Start of the current calendar month in UTC, as an ISO string. */
export function startOfCurrentMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
