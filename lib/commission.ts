/**
 * Commission is tiered by each seller's cumulative RELEASED sales total
 * within the current calendar month (not per-order, not signup plan).
 *
 * Brackets (inclusive of the cumulative total *after* adding this order):
 *   $0    – $499.99  -> 20%
 *   $500  – $999.99  -> 15%
 *   $1000+           -> 10%
 *
 * The rate is finalized once, at escrow-release time (buyer accepts
 * delivery), using whatever bracket the seller's month-to-date total
 * lands in at that moment. Orders placed earlier in the month are not
 * retroactively re-priced when the seller crosses a threshold later —
 * each order's commission is locked in when *that* order is released.
 */
export function commissionRateForCumulative(cumulativeAfterThisOrder: number): number {
  if (cumulativeAfterThisOrder >= 1000) return 10;
  if (cumulativeAfterThisOrder >= 500) return 15;
  return 20;
}

/** Start of the current calendar month in UTC, as an ISO string. */
export function startOfCurrentMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
