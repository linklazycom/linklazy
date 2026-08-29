/**
 * Commission is tiered by each seller's cumulative RELEASED sales total
 * within the current calendar month (not per-order, not signup plan).
 *
 * Brackets (inclusive of the cumulative total *after* adding this order),
 * amounts in the platform's base currency (৳):
 *   ৳0    – ৳499.99  -> 20%
 *   ৳500  – ৳999.99  -> 15%
 *   ৳1000+           -> 10%
 *
 * The rate is finalized once, at escrow-release time (buyer accepts
 * delivery), using whatever bracket the seller's month-to-date total
 * lands in at that moment. Orders placed earlier in the month are not
 * retroactively re-priced when the seller crosses a threshold later —
 * each order's commission is locked in when *that* order is released.
 *
 * TIERS is the single source of truth — both the pricing logic below and
 * the seller-facing "commission tier" dashboard widget read from it, so
 * the two can never drift out of sync.
 */
export const COMMISSION_TIERS = [
  { minCumulative: 0, rate: 20 },
  { minCumulative: 500, rate: 15 },
  { minCumulative: 1000, rate: 10 },
] as const;

export function commissionRateForCumulative(cumulativeAfterThisOrder: number): number {
  let rate: number = COMMISSION_TIERS[0].rate;
  for (const tier of COMMISSION_TIERS) {
    if (cumulativeAfterThisOrder >= tier.minCumulative) rate = tier.rate;
  }
  return rate;
}

/** Where a seller currently sits across the tiers, and what it'd take to
 * reach the next one — powers the dashboard "commission tier" widget. */
export function commissionTierProgress(cumulativeThisMonth: number) {
  const currentIndex = [...COMMISSION_TIERS]
    .reverse()
    .findIndex((t) => cumulativeThisMonth >= t.minCumulative);
  const resolvedIndex = COMMISSION_TIERS.length - 1 - currentIndex;
  const current = COMMISSION_TIERS[resolvedIndex];
  const next = COMMISSION_TIERS[resolvedIndex + 1] ?? null;

  return {
    tiers: COMMISSION_TIERS,
    currentIndex: resolvedIndex,
    currentRate: current.rate,
    cumulativeThisMonth,
    nextTier: next,
    amountToNextTier: next ? Math.max(0, next.minCumulative - cumulativeThisMonth) : 0,
    isTopTier: next === null,
  };
}

/** Start of the current calendar month in UTC, as an ISO string. */
export function startOfCurrentMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
