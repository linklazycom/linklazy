import { TrendingDown } from "lucide-react";
import { commissionTierProgress } from "@/lib/commission";

/** Shows a seller where they sit on the tiered-commission ladder this
 * month, and — the actual point of it — how close they are to the next,
 * lower rate: "sell $X more this month and your commission drops to Y%".
 * Framing it as a nudge rather than a flat fee table is what turns a
 * pricing disclosure into something that motivates more selling.
 *
 * The tiers themselves are defined in USD ($500 / $1000), while the
 * seller's actual sales are stored and priced in ৳ — so both units are
 * shown together (USD as the rule, ৳ as what it means in practice, since
 * that's the currency sellers actually price their listings in). */
export function CommissionTierCard({
  cumulativeThisMonthBdt,
  bdtPerUsd,
}: {
  cumulativeThisMonthBdt: number;
  bdtPerUsd: number;
}) {
  const progress = commissionTierProgress(cumulativeThisMonthBdt, bdtPerUsd);
  const {
    tiers,
    currentIndex,
    currentRate,
    cumulativeThisMonthUsd,
    nextTier,
    amountToNextTierUsd,
    amountToNextTierBdt,
    isTopTier,
  } = progress;

  // Progress within the *current* tier's own USD span, for the bar fill —
  // not progress across the whole ladder, so the bar visibly moves even
  // early in a tier instead of looking stuck at a sliver.
  const tierFloorUsd = tiers[currentIndex].minUsd;
  const tierSpanUsd = nextTier ? nextTier.minUsd - tierFloorUsd : tierFloorUsd || 1;
  const withinTierUsd = cumulativeThisMonthUsd - tierFloorUsd;
  const fillPct = isTopTier ? 100 : Math.min(100, Math.round((withinTierUsd / tierSpanUsd) * 100));

  return (
    <div className="rounded-chip border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium">Commission this month</p>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 font-display text-sm font-semibold text-brand-violet">
          {currentRate}%
        </span>
      </div>

      {/* Tier ladder — each rung lit up once the seller's cumulative
          sales for the month (converted to USD) reach it. */}
      <div className="mb-3 flex gap-1">
        {tiers.map((tier, i) => (
          <div
            key={tier.rate}
            className={`h-1.5 flex-1 rounded-full ${
              i <= currentIndex ? "bg-brand-violet" : "bg-line"
            }`}
          >
            {i === currentIndex && (
              <div
                className="h-1.5 rounded-full bg-brand-gradient"
                style={{ width: `${fillPct}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mb-4 flex justify-between text-xs text-muted">
        {tiers.map((tier) => (
          <span key={tier.rate}>
            ${tier.minUsd.toLocaleString()}+ · {tier.rate}%
          </span>
        ))}
      </div>

      <p className="text-sm leading-relaxed">
        {isTopTier ? (
          <>
            You&apos;ve hit LinkLazy&apos;s lowest rate — <span className="font-medium">10%</span> on
            everything else you sell this month.
          </>
        ) : cumulativeThisMonthUsd === 0 ? (
          <>
            Every seller starts the month at 20%.{" "}
            <span className="font-medium">
              Sell ${amountToNextTierUsd.toLocaleString()} (≈ ৳{amountToNextTierBdt.toLocaleString()})
            </span>{" "}
            this month and your commission drops to{" "}
            <span className="font-medium text-brand-violet">{nextTier!.rate}%</span>.
          </>
        ) : (
          <>
            <span className="font-medium">
              ${amountToNextTierUsd.toLocaleString()} more (≈ ৳{amountToNextTierBdt.toLocaleString()})
            </span>{" "}
            in sales this month and your commission drops to{" "}
            <span className="font-medium text-brand-violet">{nextTier!.rate}%</span> — you&apos;ve
            already sold ${cumulativeThisMonthUsd.toFixed(0)} (৳{cumulativeThisMonthBdt.toLocaleString()})
            this month.
          </>
        )}
      </p>

      {!isTopTier && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <TrendingDown className="h-3.5 w-3.5" />
          Commission resets to 20% at the start of each calendar month.
        </p>
      )}
    </div>
  );
}
