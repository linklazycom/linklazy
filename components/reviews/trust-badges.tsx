import { cn } from "@/lib/utils";

interface Props {
  completionRate: number | null;
  avgResponseHours: number | null;
  disputeRate: number | null;
  completedOrderCount: number;
  className?: string;
}

const MIN_SAMPLE = 5;

/**
 * Renders 0-3 small badges based on auto-computed cron metrics
 * (profiles.completion_rate / avg_response_hours / dispute_rate). Below
 * MIN_SAMPLE completed orders we show nothing rather than a "100%
 * completion" badge built on one lucky order — a small sample is
 * misleading, not reassuring.
 */
export function TrustBadges({
  completionRate,
  avgResponseHours,
  disputeRate,
  completedOrderCount,
  className,
}: Props) {
  if (completedOrderCount < MIN_SAMPLE) return null;

  const badges: { label: string; tone: string }[] = [];

  if (completionRate != null && completionRate >= 0.95) {
    badges.push({ label: "High completion rate", tone: "bg-signal-soft text-signal" });
  }
  if (avgResponseHours != null && avgResponseHours <= 24) {
    badges.push({ label: "Fast responder", tone: "bg-brand-soft text-brand-violet" });
  }
  if (disputeRate != null && disputeRate <= 0.02) {
    badges.push({ label: "Low dispute rate", tone: "bg-amber-soft text-amber" });
  }

  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={cn("rounded-chip px-2 py-0.5 text-[11px] font-medium", b.tone)}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
