import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// A bKash/PayPal payment still "initiated" after this long was either abandoned
// or paid-but-not-confirmed (browser closed, callback failed). Worth a look.
const STUCK_AFTER_MINUTES = 30;

type StuckPayment = {
  id: string;
  order_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  credit_amount_bdt: number | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  status: string;
  price_amount: number | null;
  seller_id: string;
  buyer_id: string;
  site_id: string;
  accepted_at: string | null;
  created_at: string;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        <span className={`text-sm ${count > 0 ? "font-medium text-red-600" : "text-muted"}`}>
          {count > 0 ? `${count} to review` : "All clear"}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      {children}
    </section>
  );
}

/** ISO time N minutes ago (kept outside the page so the render stays pure). */
function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export default async function AdminPaymentHealthPage() {
  const supabase = await createClient();
  const cutoff = minutesAgoIso(STUCK_AFTER_MINUTES);

  // 1) Payments that never finished
  const { data: stuckRaw } = await supabase
    .from("payments")
    .select("id, order_id, provider, amount, currency, credit_amount_bdt, created_at")
    .eq("status", "initiated")
    .in("provider", ["bkash", "paypal"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);
  const stuck = (stuckRaw ?? []) as StuckPayment[];

  // 2) Paid orders that moved past payment but have no payment record
  const { data: openOrdersRaw } = await supabase
    .from("orders")
    .select("id, status, price_amount, seller_id, buyer_id, site_id, accepted_at, created_at")
    .eq("order_type", "paid")
    .not("status", "in", "(pending_payment,cancelled,refunded)")
    .order("created_at", { ascending: false })
    .limit(300);
  const paidOrders = (openOrdersRaw ?? []) as OrderRow[];

  const orderIds = paidOrders.map((o) => o.id);
  const { data: payRows } = orderIds.length
    ? await supabase.from("payments").select("order_id").in("order_id", orderIds)
    : { data: [] as { order_id: string }[] };
  const withPayment = new Set((payRows ?? []).map((p) => p.order_id));
  const missingPayment = paidOrders.filter((o) => !withPayment.has(o.id));

  // 3) Accepted orders whose seller payout is not in the wallet ledger
  const accepted = paidOrders.filter((o) => o.status === "accepted" && o.accepted_at);
  const sellerIds = [...new Set(accepted.map((o) => o.seller_id))];
  const { data: payoutRows } = sellerIds.length
    ? await supabase
        .from("wallet_ledger")
        .select("user_id, related_user_id, related_site_id, created_at, notes")
        .eq("type", "seller_earning")
        .in("user_id", sellerIds)
        .like("notes", "Order payout%")
        .limit(2000)
    : { data: [] as { user_id: string; related_user_id: string | null; related_site_id: string | null; created_at: string; notes: string | null }[] };

  const noPayout = accepted.filter((o) => {
    const acceptedAt = new Date(o.accepted_at as string).getTime();
    return !(payoutRows ?? []).some((w) => {
      if (w.user_id !== o.seller_id || w.related_user_id !== o.buyer_id || w.related_site_id !== o.site_id) {
        return false;
      }
      const diff = new Date(w.created_at).getTime() - acceptedAt;
      return diff >= -60_000 && diff <= 30 * 60_000; // payout is written right after acceptance
    });
  });

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Payment health</h1>
      <p className="mb-8 text-sm text-muted">
        Read-only checks that catch money that is stuck or does not add up. Nothing here changes data.
      </p>

      <Section
        title="Payments stuck in “initiated”"
        hint={`bKash/PayPal payments older than ${STUCK_AFTER_MINUTES} minutes that never completed. Check the payment in the provider's dashboard before doing anything: if the customer was charged, the wallet/order must be fixed by hand; otherwise it was simply abandoned.`}
        count={stuck.length}
      >
        <div className="space-y-2">
          {stuck.map((p) => (
            <div key={p.id} className="rounded-chip border border-line bg-white p-3 text-sm">
              <span className="font-medium">
                {p.provider} · {p.amount} {p.currency}
              </span>
              {p.credit_amount_bdt ? <span className="text-muted"> (wallet top-up ৳{p.credit_amount_bdt})</span> : null}
              <span className="text-muted"> · {new Date(p.created_at).toLocaleString()}</span>
              {p.order_id ? (
                <Link href={`/admin/orders/${p.order_id}`} className="ml-2 underline">
                  order {shortId(p.order_id)}
                </Link>
              ) : (
                <span className="ml-2 text-muted">top-up · payment {shortId(p.id)}</span>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Paid orders with no payment record"
        hint="These orders are past the payment step but nothing proves money is held. They cannot be paid out until a payment record exists."
        count={missingPayment.length}
      >
        <div className="space-y-2">
          {missingPayment.map((o) => (
            <div key={o.id} className="rounded-chip border border-line bg-white p-3 text-sm">
              <Link href={`/admin/orders/${o.id}`} className="font-medium underline">
                order {shortId(o.id)}
              </Link>
              <span className="text-muted">
                {" "}
                · {o.status} · ৳{o.price_amount} · {new Date(o.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Accepted orders without a seller payout"
        hint="The order is accepted, but no matching “Order payout” entry was found in the seller's wallet ledger within 30 minutes of acceptance. The check is approximate, so confirm in the wallet ledger first."
        count={noPayout.length}
      >
        <div className="space-y-2">
          {noPayout.map((o) => (
            <div key={o.id} className="rounded-chip border border-line bg-white p-3 text-sm">
              <Link href={`/admin/orders/${o.id}`} className="font-medium underline">
                order {shortId(o.id)}
              </Link>
              <span className="text-muted">
                {" "}
                · ৳{o.price_amount} · accepted {o.accepted_at ? new Date(o.accepted_at).toLocaleString() : ""}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-xs text-muted">
        Showing up to the 300 most recent paid orders and 100 stuck payments.
      </p>
    </div>
  );
}
