import { cn } from "@/lib/utils";

const TIER_STYLES: Record<string, string> = {
  gold: "border-amber/40 bg-amber-soft text-amber",
  silver: "border-line bg-paper text-ink",
  bronze: "border-brand-violet/30 bg-brand-soft text-brand-violet",
};

const TIER_LABELS: Record<string, string> = {
  gold: "Gold Seller",
  silver: "Silver Seller",
  bronze: "Bronze Seller",
};

export function SellerTierBadge({ tier, className }: { tier: string | null; className?: string }) {
  if (!tier || tier === "unranked" || !TIER_LABELS[tier]) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-1 font-mono text-xs",
        TIER_STYLES[tier],
        className
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
