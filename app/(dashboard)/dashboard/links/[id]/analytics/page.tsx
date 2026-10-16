import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClicksBarChart } from "@/components/analytics/bar-chart";
import { BreakdownList } from "@/components/analytics/breakdown-list";
import { Button } from "@/components/ui/button";
import { countryName, fillDaily, parseAnalytics } from "@/lib/analytics/format";
import { isLinkFeatureOn, shortUrlFor } from "@/lib/links/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Link analytics" };

const RANGES = [7, 30, 90, 365];
const cap = (s: string) => (s === "(direct)" ? "Direct / none" : s.charAt(0).toUpperCase() + s.slice(1));

export default async function LinkAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isLinkFeatureOn())) return <p className="text-muted">Link management is temporarily turned off.</p>;

  const { data: link } = await supabase.from("short_links").select("id, user_id, slug, title, click_count").eq("id", id).maybeSingle();
  if (!link || link.user_id !== user.id) notFound();

  // The SQL function re-checks ownership and returns NULL for anyone else.
  const { data: raw, error } = await supabase.rpc("link_analytics", { p_link_id: id, p_days: days });
  const a = error ? null : parseAnalytics(raw);
  if (!a) {
    return (
      <div className="max-w-3xl space-y-3">
        <Link href={`/dashboard/links/${id}`} className="text-sm text-muted underline">
          ← Back to link
        </Link>
        <p className="text-muted">Analytics are not available right now. Please try again in a moment.</p>
      </div>
    );
  }
  const daily = fillDaily(a.daily, a.from, a.days);
  const qrShare = a.totals.clicks > 0 ? Math.round((a.totals.qr / a.totals.clicks) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/dashboard/links/${id}`} className="text-sm text-muted underline">
          ← Back to link
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium">Analytics · {link.title || link.slug}</h1>
        <p className="font-mono text-xs text-muted">{shortUrlFor(link.slug)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={`/dashboard/links/${id}/analytics?days=${r}`} className={cn("rounded-chip border px-3 py-1.5", r === days ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}>
              {r === 365 ? "1 year" : `${r} days`}
            </Link>
          ))}
        </div>
        <a href={`/api/links/${id}/analytics/export?days=${days}`}>
          <Button variant="secondary" size="sm" type="button">
            Export CSV
          </Button>
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: `Clicks (${days}d)`, value: a.totals.clicks },
          { label: "Unique visitors (counted per day)", value: a.totals.uniques },
          { label: "From QR scans", value: `${a.totals.qr}${a.totals.clicks ? ` (${qrShare}%)` : ""}` },
        ].map((c) => (
          <div key={c.label} className="rounded-chip border border-line bg-white p-4">
            <p className="font-mono text-2xl">{c.value}</p>
            <p className="text-xs text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-chip border border-line bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">Clicks per day (UTC)</h2>
        <ClicksBarChart data={daily} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BreakdownList title="Countries" rows={a.countries} label={countryName} />
        <BreakdownList title="Referrers" rows={a.referrers} label={cap} />
        <BreakdownList title="Devices" rows={a.devices} label={cap} />
        <BreakdownList title="Browsers" rows={a.browsers} label={cap} />
        <BreakdownList title="Source" rows={a.sources} label={(k) => (k === "qr" ? "QR code scan" : "Direct link")} />
      </div>

      <p className="text-xs text-muted">
        Bots, link previews and repeat clicks within 10 seconds are not counted. Visitor ids are a one-way daily hash (no IP addresses are stored), so a
        returning visitor counts once per day. Detailed click logs are kept for a limited period (90 days by default); older days stay in the totals.
      </p>
    </div>
  );
}
