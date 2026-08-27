import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { TrendBarChart } from "@/components/admin/trend-bar-chart";

function hostnameFromReferrer(referrer: string | null): string {
  if (!referrer) return "Direct / none";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function dayKey(iso: string): string {
  return iso.slice(5, 10); // "MM-DD"
}

/** Builds one bar per day between `since` and `now` (inclusive), even for
 * days with zero events, so the chart's x-axis doesn't silently compress. */
function bucketByDay(dates: string[], since: Date, days: number) {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1);

  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(5, 10);
    out.push({ label: key, value: counts.get(key) ?? 0 });
  }
  return out;
}

function pctChange(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "+new" : null;
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}%`;
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: string | null;
}) {
  const positive = delta?.startsWith("+");
  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl font-medium">{value}</p>
        {delta && (
          <span
            className={
              "text-xs font-medium " +
              (positive ? "text-emerald-600" : delta === "+new" ? "text-emerald-600" : "text-red-600")
            }
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const days = rangeParam === "7" ? 7 : rangeParam === "90" ? 90 : 30;

  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const prevSince = new Date();
  prevSince.setDate(prevSince.getDate() - days * 2);

  const [
    { data: views, count: totalViews },
    { count: prevViews },
    { data: newProfiles, count: newSignups },
    { count: prevSignups },
    { count: newListings },
    { count: prevListings },
    { data: rangeOrders, count: newOrders },
    { count: prevOrders },
    { count: quotaUnlocks },
    { count: walletUnlocks },
    { count: prevQuotaUnlocks },
    { count: prevWalletUnlocks },
  ] = await Promise.all([
    supabase
      .from("page_views")
      .select("path, referrer, utm_source, created_at", { count: "exact" })
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("profiles")
      .select("created_at, role", { count: "exact" })
      .gte("created_at", since.toISOString()),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString()),
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("orders")
      .select("id, status, price_amount, created_at", { count: "exact" })
      .gte("created_at", since.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("credits_ledger")
      .select("id", { count: "exact", head: true })
      .eq("type", "unlock_spend")
      .gte("created_at", since.toISOString()),
    supabase
      .from("site_unlocks")
      .select("id", { count: "exact", head: true })
      .gte("unlocked_at", since.toISOString()),
    supabase
      .from("credits_ledger")
      .select("id", { count: "exact", head: true })
      .eq("type", "unlock_spend")
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("site_unlocks")
      .select("id", { count: "exact", head: true })
      .gte("unlocked_at", prevSince.toISOString())
      .lt("unlocked_at", since.toISOString()),
  ]);

  const bySource = new Map<string, number>();
  const byPath = new Map<string, number>();
  for (const v of views ?? []) {
    const source = v.utm_source || hostnameFromReferrer(v.referrer);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
  }
  const topSources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topPaths = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const pageviewTrend = bucketByDay((views ?? []).map((v) => v.created_at), since, days);
  const signupTrend = bucketByDay((newProfiles ?? []).map((p) => p.created_at), since, days);

  const roleBreakdown = new Map<string, number>();
  for (const p of newProfiles ?? []) {
    roleBreakdown.set(p.role, (roleBreakdown.get(p.role) ?? 0) + 1);
  }

  const orderStatusBreakdown = new Map<string, number>();
  for (const o of rangeOrders ?? []) {
    orderStatusBreakdown.set(o.status, (orderStatusBreakdown.get(o.status) ?? 0) + 1);
  }
  const completedOrders =
    (orderStatusBreakdown.get("accepted") ?? 0) + (orderStatusBreakdown.get("delivered") ?? 0);
  const totalOrdersForRate = rangeOrders?.length ?? 0;
  const completionRate = totalOrdersForRate
    ? `${Math.round((completedOrders / totalOrdersForRate) * 100)}%`
    : "—";

  const totalUnlocks = (quotaUnlocks ?? 0) + (walletUnlocks ?? 0);
  const prevTotalUnlocks = (prevQuotaUnlocks ?? 0) + (prevWalletUnlocks ?? 0);
  const unlockRate =
    totalViews && totalViews > 0 ? `${((totalUnlocks / totalViews) * 100).toFixed(1)}%` : "—";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl font-medium">Traffic &amp; analytics</h1>
          <p className="text-sm text-muted">
            Self-hosted first-party data. vs. previous {days}-day period.
          </p>
        </div>
        <div className="flex gap-1 rounded-chip border border-line bg-white p-1 text-sm">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/admin/analytics?range=${d}`}
              className={
                "rounded-chip px-3 py-1 " +
                (days === d ? "bg-brand-soft font-medium text-brand-violet" : "text-muted hover:text-ink")
              }
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Pageviews" value={totalViews ?? 0} delta={pctChange(totalViews ?? 0, prevViews ?? 0)} />
        <KpiCard label="New signups" value={newSignups ?? 0} delta={pctChange(newSignups ?? 0, prevSignups ?? 0)} />
        <KpiCard label="New listings" value={newListings ?? 0} delta={pctChange(newListings ?? 0, prevListings ?? 0)} />
        <KpiCard label="Orders" value={newOrders ?? 0} delta={pctChange(newOrders ?? 0, prevOrders ?? 0)} />
        <KpiCard label="Site unlocks" value={totalUnlocks} delta={pctChange(totalUnlocks, prevTotalUnlocks)} />
        <KpiCard label="Order completion" value={completionRate} />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Pageviews / day</h2>
          <TrendBarChart data={pageviewTrend} />
        </div>
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Signups / day</h2>
          <TrendBarChart data={signupTrend} color="#B23CFC" />
        </div>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-medium">Signups by role</h2>
          <div className="flex flex-wrap gap-2">
            {["buyer", "seller", "both"].map((r) => (
              <MetricChip key={r} label={r} value={roleBreakdown.get(r) ?? 0} />
            ))}
          </div>
        </div>
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-medium">Orders by status</h2>
          <div className="flex flex-wrap gap-2">
            {[...orderStatusBreakdown.entries()].map(([status, count]) => (
              <MetricChip key={status} label={status.replace(/_/g, " ")} value={count} />
            ))}
            {!orderStatusBreakdown.size && <p className="text-sm text-muted">No orders yet.</p>}
          </div>
        </div>
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-medium">Listing → unlock conversion</h2>
          <p className="font-display text-xl font-medium">{unlockRate}</p>
          <p className="mt-1 text-xs text-muted">
            {totalUnlocks} unlocks ({quotaUnlocks ?? 0} plan, {walletUnlocks ?? 0} wallet) across{" "}
            {totalViews ?? 0} pageviews.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Top traffic sources</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <tbody>
                {topSources.map(([source, count]) => (
                  <tr key={source} className="border-b border-line last:border-0">
                    <td className="max-w-[1px] truncate py-2">{source}</td>
                    <td className="py-2 text-right font-mono">{count}</td>
                  </tr>
                ))}
                {!topSources.length && (
                  <tr>
                    <td className="py-2 text-muted">No data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Top pages</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <tbody>
                {topPaths.map(([path, count]) => (
                  <tr key={path} className="border-b border-line last:border-0">
                    <td className="max-w-[1px] truncate py-2 font-mono text-xs">{path}</td>
                    <td className="py-2 text-right font-mono">{count}</td>
                  </tr>
                ))}
                {!topPaths.length && (
                  <tr>
                    <td className="py-2 text-muted">No data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        This is self-hosted, first-party tracking (no cookies, no third-party
        script) — it always works even before Google Analytics is
        configured. Set a GA4 Measurement ID in Settings for a second,
        independent view in Google&apos;s own dashboard. Revenue and payout
        detail live on the{" "}
        <Link href="/admin/revenue" className="underline">
          Revenue
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
