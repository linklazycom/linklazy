import { cn } from "@/lib/utils";

interface Props {
  isFeatured?: boolean;
  createdAt?: string | null;
  da?: number | null;
  drVerified?: number | null;
  className?: string;
}

const NEW_WINDOW_DAYS = 14;
// A site counts as "Top" once it clears either threshold — DA is what most
// buyers recognize, DR-verified is the trustworthy Ahrefs number when we
// have it. Either signal is enough to earn the badge.
const TOP_DA_THRESHOLD = 70;
const TOP_DR_THRESHOLD = 60;

function isNew(createdAt?: string | null) {
  if (!createdAt) return false;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= NEW_WINDOW_DAYS;
}

function isTop(da?: number | null, drVerified?: number | null) {
  return (da != null && da >= TOP_DA_THRESHOLD) || (drVerified != null && drVerified >= TOP_DR_THRESHOLD);
}

/**
 * Small pill badges shown on site cards: "Featured" (admin-curated, via
 * sites.is_featured), "New" (listed within the last two weeks), and "Top"
 * (DA 70+ or a verified DR 60+). Computed from data already on the card —
 * only is_featured needs a DB column, the other two derive automatically
 * so nobody has to remember to tag a site as new or top.
 */
export function SiteHighlightBadges({ isFeatured, createdAt, da, drVerified, className }: Props) {
  const badges: { label: string; classes: string }[] = [];

  if (isFeatured) {
    badges.push({ label: "★ Featured", classes: "bg-brand-gradient text-white" });
  }
  if (isNew(createdAt)) {
    badges.push({ label: "New", classes: "bg-signal text-white" });
  }
  if (isTop(da, drVerified)) {
    badges.push({ label: "Top", classes: "bg-amber text-white" });
  }

  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm",
            b.classes
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
