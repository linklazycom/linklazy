const HAPPY_PATH = [
  { key: "placed", label: "Placed" },
  { key: "in_progress", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "accepted", label: "Accepted" },
] as const;

/**
 * Maps every real order status onto a step index in the happy-path
 * lifecycle. `pending_payment` and `awaiting_seller_site` both map to
 * step 0 ("Placed") — they're the same lifecycle stage from a progress
 * point of view (order exists, work hasn't started), just different order
 * types (paid vs exchange) sitting at that stage for a different reason.
 */
function stepIndexFor(status: string): number {
  switch (status) {
    case "pending_payment":
    case "awaiting_seller_site":
      return 0;
    case "in_progress":
      return 1;
    case "delivered":
      return 2;
    case "accepted":
      return 3;
    default:
      return -1; // terminal/off-path status — rendered separately
  }
}

const TERMINAL_META: Record<string, { label: string; tone: string; dot: string }> = {
  disputed: { label: "Disputed", tone: "text-amber bg-amber-soft border-amber/30", dot: "bg-amber" },
  cancelled: { label: "Cancelled", tone: "text-muted bg-paper border-line", dot: "bg-line" },
  refunded: { label: "Refunded", tone: "text-muted bg-paper border-line", dot: "bg-line" },
};

/**
 * Compact step indicator for list rows. Terminal statuses (disputed,
 * cancelled, refunded) still show the happy-path steps completed up to
 * where things broke — a dimmed pill on its own gives no sense of how far
 * the order got, which matters when scanning a list of many orders.
 */
export function OrderProgress({ status }: { status: string }) {
  const terminal = TERMINAL_META[status];
  // Disputes can happen from "in_progress" or "delivered" — approximate
  // where by treating disputed as having reached "delivered" if a proof
  // step would already exist, otherwise "in_progress". Cancelled/refunded
  // most commonly happen pre-delivery, so anchor those at step 0.
  const current = terminal ? (status === "disputed" ? 2 : 0) : stepIndexFor(status);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={`Order progress: ${status}`}>
      <div className="flex items-center gap-1.5">
        {HAPPY_PATH.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  i < current
                    ? "bg-signal text-white"
                    : i === current && !terminal
                      ? "bg-signal text-white ring-4 ring-signal/20"
                      : "bg-paper text-muted ring-1 ring-inset ring-line"
                }`}
              >
                {i < current ? "✓" : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[10px] font-medium ${
                  i <= current ? "text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < HAPPY_PATH.length - 1 && (
              <div className={`h-0.5 w-5 rounded-full ${i < current ? "bg-signal" : "bg-line"}`} />
            )}
          </div>
        ))}
      </div>
      {terminal && (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${terminal.tone}`}>
          {terminal.label}
        </span>
      )}
    </div>
  );
}
