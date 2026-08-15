import { drBand } from "@/lib/ahrefs";
import { cn } from "@/lib/utils";

interface Props {
  /** Seller-entered DR from the submission form (unverified). */
  selfReportedDr?: number | null;
  /** Ahrefs-fetched DR, refreshed weekly. */
  verifiedDr?: number | null;
  className?: string;
}

const BAND_LABEL: Record<ReturnType<typeof drBand>, string> = {
  new: "New",
  growing: "Growing",
  established: "Established",
  strong: "Strong",
  elite: "Elite",
};

const BAND_CLASSES: Record<ReturnType<typeof drBand>, string> = {
  new: "bg-line text-muted",
  growing: "bg-amber-soft text-amber",
  established: "bg-brand-soft text-brand-violet",
  strong: "bg-signal-soft text-signal",
  elite: "bg-signal text-white",
};

/**
 * Shows the Ahrefs-verified DR when we have one (green check, band color).
 * If we haven't checked yet, falls back to the seller's self-reported DR
 * with an "unverified" label — we never hide the seller's number, we just
 * make clear which one to trust.
 */
export function DrBadge({ selfReportedDr, verifiedDr, className }: Props) {
  if (verifiedDr != null) {
    const band = drBand(verifiedDr);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-xs font-medium",
          BAND_CLASSES[band],
          className
        )}
        title={`Domain Rating ${verifiedDr}, verified via Ahrefs — ${BAND_LABEL[band]}`}
      >
        DR {verifiedDr}
        <span className="inline-flex items-center gap-0.5 font-semibold">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.6 3.6 6.7-6.7a1 1 0 011.4 0z"
              clipRule="evenodd"
            />
          </svg>
          Verified
        </span>
      </span>
    );
  }

  if (selfReportedDr != null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-chip bg-line px-2 py-1 text-xs font-medium text-muted",
          className
        )}
        title="Seller-reported DR — not yet verified via Ahrefs"
      >
        DR {selfReportedDr}
        <span className="text-[10px] italic">unverified</span>
      </span>
    );
  }

  return null;
}
