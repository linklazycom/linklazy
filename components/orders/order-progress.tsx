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

const TERMINAL_LABEL: Record<string, string> = {
  disputed: "Disputed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function OrderProgress({ status }: { status: string }) {
  if (status in TERMINAL_LABEL) {
    const tone = status === "disputed" ? "text-amber bg-amber-soft" : "text-muted bg-paper";
    return (
      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
        {TERMINAL_LABEL[status]}
      </span>
    );
  }

  const current = stepIndexFor(status);

  return (
    <div className="flex items-center gap-1.5" aria-label={`Order progress: ${status}`}>
      {HAPPY_PATH.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`h-2 w-2 rounded-full ${
                i < current
                  ? "bg-signal"
                  : i === current
                    ? "bg-signal ring-2 ring-signal/30"
                    : "bg-line"
              }`}
            />
            <span
              className={`whitespace-nowrap text-[10px] ${
                i <= current ? "text-ink" : "text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < HAPPY_PATH.length - 1 && (
            <div className={`h-px w-4 ${i < current ? "bg-signal" : "bg-line"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
