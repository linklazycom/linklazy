const STEPS = [
  {
    key: "placed",
    label: "Order placed",
    buyerHint: "Waiting on payment or seller confirmation before work begins.",
    sellerHint: "A buyer has placed this order — accept the payment/exchange terms to start.",
  },
  {
    key: "in_progress",
    label: "In progress",
    buyerHint: "The seller is working on placing your link.",
    sellerHint: "Publish the link, then submit delivery proof below.",
  },
  {
    key: "delivered",
    label: "Delivered",
    buyerHint: "The seller submitted proof — check the live link and accept if it's correct.",
    sellerHint: "Proof submitted — waiting on the buyer to review and accept.",
  },
  {
    key: "accepted",
    label: "Accepted",
    buyerHint: "Order complete. Payment has been released to the seller.",
    sellerHint: "Order complete. Payment has been released to your wallet.",
  },
] as const;

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
      return -1;
  }
}

const TERMINAL_META: Record<string, { label: string; body: string; tone: string; icon: string }> = {
  disputed: {
    label: "Under dispute",
    body: "An admin is reviewing this order. You don't need to do anything else here — you'll be notified once it's resolved.",
    tone: "border-amber/30 bg-amber-soft text-amber",
    icon: "!",
  },
  cancelled: {
    label: "Cancelled",
    body: "This order was cancelled. Any escrowed payment was refunded to the buyer.",
    tone: "border-line bg-paper text-muted",
    icon: "✕",
  },
  refunded: {
    label: "Refunded",
    body: "This order was refunded to the buyer.",
    tone: "border-line bg-paper text-muted",
    icon: "↩",
  },
};

/**
 * Large vertical timeline for order detail pages — one row per lifecycle
 * step with a status dot, label, and a role-specific one-line hint about
 * what happens at that step / what to do next. `role` controls which hint
 * copy shows; pass "admin" to show both sides' hints together.
 */
export function OrderTimeline({
  status,
  role,
}: {
  status: string;
  role: "buyer" | "seller" | "admin";
}) {
  const terminal = TERMINAL_META[status];
  const current = terminal ? (status === "disputed" ? 2 : 0) : stepIndexFor(status);

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <ol className="space-y-0">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current && !terminal;
          const upcoming = i > current;
          return (
            <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
              {i < STEPS.length - 1 && (
                <span
                  className={`absolute left-[15px] top-8 h-full w-0.5 ${
                    done ? "bg-signal" : "bg-line"
                  }`}
                  aria-hidden
                />
              )}
              <div
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-signal text-white"
                    : active
                      ? "bg-signal text-white ring-4 ring-signal/20"
                      : "bg-paper text-muted ring-1 ring-inset ring-line"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 pt-1">
                <p className={`text-sm font-semibold ${upcoming ? "text-muted" : "text-ink"}`}>
                  {step.label}
                </p>
                {(active || done) && (
                  <div className="mt-1 space-y-0.5 text-xs text-muted">
                    {(role === "buyer" || role === "admin") && (
                      <p>{role === "admin" ? `Buyer: ${step.buyerHint}` : step.buyerHint}</p>
                    )}
                    {(role === "seller" || role === "admin") && (
                      <p>{role === "admin" ? `Seller: ${step.sellerHint}` : step.sellerHint}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {terminal && (
        <div className={`mt-2 flex items-start gap-3 rounded-chip border p-3 text-sm ${terminal.tone}`}>
          <span className="mt-0.5 font-bold">{terminal.icon}</span>
          <div>
            <p className="font-semibold">{terminal.label}</p>
            <p className="mt-0.5 text-xs opacity-90">{terminal.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
