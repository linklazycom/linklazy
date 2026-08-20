import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

function hostnameFromReferrer(referrer: string | null): string {
  if (!referrer) return "Direct / none";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: views, count: totalViews } = await supabase
    .from("page_views")
    .select("path, referrer, utm_source, created_at", { count: "exact" })
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  const bySource = new Map<string, number>();
  const byPath = new Map<string, number>();

  for (const v of views ?? []) {
    const source = v.utm_source || hostnameFromReferrer(v.referrer);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
  }

  const topSources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topPaths = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Traffic &amp; analytics</h1>
      <p className="mb-6 text-sm text-muted">Last 30 days, self-hosted pageview data.</p>

      <div className="mb-8 flex gap-2">
        <MetricChip label="Pageviews (30d)" value={totalViews ?? 0} tone="verified" />
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
        independent view in Google&apos;s own dashboard.
      </p>
    </div>
  );
}
