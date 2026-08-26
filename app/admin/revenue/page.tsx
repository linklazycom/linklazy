import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Money } from "@/components/currency/money";

interface DayBucket {
  date: string;
  commission: number;
  payPerView: number;
}

function dayKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = range === "7" ? 7 : range === "90" ? 90 : 30;

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  // ---- 1. Order commissions (escrow fee on completed paid orders) ----
  // Commission is finalized when the buyer accepts delivery (order status
  // flips to "accepted" — see app/api/orders/[id]/accept/route.ts). Orders
  // never carry a "released" status themselves ("released" is a *payments*
  // row status); querying orders for status "released" silently matched
  // zero rows and made this whole section always show ৳0.
  const { data: releasedOrders } = await supabase
    .from("orders")
    .select("id, commission_amount, price_amount, created_at, status")
    .eq("status", "accepted")
    .not("commission_amount", "is", null)
    .gte("created_at", sinceIso);

  const commissionTotal = (releasedOrders ?? []).reduce(
    (sum, o) => sum + (o.commission_amount ?? 0),
    0
  );
  const gmvFromOrders = (releasedOrders ?? []).reduce((sum, o) => sum + (o.price_amount ?? 0), 0);

  // ---- 2. Pay-per-view platform fees (20% cut, logged in wallet_ledger) ----
  const { data: ppvFees } = await supabase
    .from("wallet_ledger")
    .select("amount, created_at")
    .eq("type", "platform_fee")
    .gte("created_at", sinceIso);

  const ppvFeeTotal = (ppvFees ?? []).reduce((sum, f) => sum + Math.abs(f.amount), 0);

  // ---- Coupons: revenue given up ----
  const { data: coupons } = await supabase
    .from("coupon_redemptions")
    .select("discount_amount, created_at")
    .gte("created_at", sinceIso);

  const couponCostTotal = (coupons ?? []).reduce((sum, c) => sum + (c.discount_amount ?? 0), 0);

  // ---- Pending withdrawals (cash going OUT, not revenue, but relevant context) ----
  const { data: pendingWithdrawals } = await supabase
    .from("withdrawal_requests")
    .select("amount")
    .in("status", ["pending", "approved"]);

  const pendingWithdrawalTotal = (pendingWithdrawals ?? []).reduce((sum, w) => sum + w.amount, 0);

  const totalRevenue = commissionTotal + ppvFeeTotal;

  // ---- Daily breakdown (for the ranges people actually look at day-by-day) ----
  const buckets = new Map<string, DayBucket>();
  const keyFn = days > 30 ? monthKey : dayKey;

  function addTo(iso: string, field: keyof Omit<DayBucket, "date">, amount: number) {
    const key = keyFn(iso);
    if (!buckets.has(key)) buckets.set(key, { date: key, commission: 0, payPerView: 0 });
    buckets.get(key)![field] += amount;
  }

  (releasedOrders ?? []).forEach((o) => addTo(o.created_at, "commission", o.commission_amount ?? 0));
  (ppvFees ?? []).forEach((f) => addTo(f.created_at, "payPerView", Math.abs(f.amount)));

  const rows = [...buckets.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  // ---- Top-earning sellers by pay-per-view (last N days) ----
  const { data: topPpvSellers } = await supabase
    .from("site_unlocks")
    .select("seller_earning, unlocked_at, sites!inner(domain, owner_id)")
    .gte("unlocked_at", sinceIso);

  const sellerEarnings = new Map<string, { domain: string; total: number; unlocks: number }>();
  (topPpvSellers ?? []).forEach((u) => {
    const site = u.sites as unknown as { domain: string; owner_id: string };
    const key = site.owner_id;
    if (!sellerEarnings.has(key)) sellerEarnings.set(key, { domain: site.domain, total: 0, unlocks: 0 });
    const entry = sellerEarnings.get(key)!;
    entry.total += u.seller_earning;
    entry.unlocks += 1;
  });
  const topSellers = [...sellerEarnings.values()].sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Revenue &amp; earnings</h1>
        <div className="flex gap-1 text-sm">
          {[
            { label: "7d", value: "7" },
            { label: "30d", value: "30" },
            { label: "90d", value: "90" },
          ].map((r) => (
            <a
              key={r.value}
              href={`/admin/revenue?range=${r.value}`}
              className={`rounded-chip border px-3 py-1.5 ${
                String(days) === r.value ? "border-ink bg-ink text-white" : "border-line bg-white"
              }`}
            >
              {r.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <MetricChip label={`Total revenue (${days}d)`} value={totalRevenue} tone="price" />
        <MetricChip label="Order commissions" value={commissionTotal} />
        <MetricChip label="Pay-per-view fees" value={ppvFeeTotal} />
        <MetricChip label="GMV (paid orders)" value={gmvFromOrders} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-chip border border-line bg-white p-4">
          <p className="text-xs text-muted">Coupon cost this period</p>
          <p className="mt-1 font-display text-xl">
            <Money amount={couponCostTotal} />
          </p>
        </div>
        <div className="rounded-chip border border-line bg-white p-4">
          <p className="text-xs text-muted">Pending withdrawals (all time, unpaid)</p>
          <p className="mt-1 font-display text-xl">
            <Money amount={pendingWithdrawalTotal} />
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-chip border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-medium">
          Revenue by {days > 30 ? "month" : "day"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-normal">{days > 30 ? "Month" : "Date"}</th>
                <th className="py-2 text-right font-normal">Commission</th>
                <th className="py-2 text-right font-normal">Pay-per-view</th>
                <th className="py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-line last:border-0">
                  <td className="py-2 font-mono text-xs">{r.date}</td>
                  <td className="py-2 text-right font-mono">
                    <Money amount={r.commission} />
                  </td>
                  <td className="py-2 text-right font-mono">
                    <Money amount={r.payPerView} />
                  </td>
                  <td className="py-2 text-right font-mono font-medium">
                    <Money amount={r.commission + r.payPerView} />
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted">
                    No revenue recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-chip border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-medium">Top earning sellers — pay-per-view ({days}d)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-normal">Site</th>
                <th className="py-2 text-right font-normal">Unlocks</th>
                <th className="py-2 text-right font-normal">Earned</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((s) => (
                <tr key={s.domain} className="border-b border-line last:border-0">
                  <td className="py-2">{s.domain}</td>
                  <td className="py-2 text-right font-mono">{s.unlocks}</td>
                  <td className="py-2 text-right font-mono">
                    <Money amount={s.total} />
                  </td>
                </tr>
              ))}
              {!topSellers.length && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted">
                    No pay-per-view unlocks in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        Commission counts as revenue as soon as the buyer accepts delivery (escrow is released to
        the seller at that point). Pay-per-view fees are counted at the moment of unlock — the
        seller&apos;s 80% share still sits in the hold period tracked on the{" "}
        <a href="/admin/ppv-unlocks" className="underline">
          Pay-per-view unlocks
        </a>{" "}
        page until it&apos;s released to their wallet.
      </p>
    </div>
  );
}
