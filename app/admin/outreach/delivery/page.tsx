import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPushEnabled } from "@/lib/outreach/server";
import { deliveryHealth, pct, sumDelivery, toDeliveryRow, type DeliveryRow } from "@/lib/outreach/reply";

export const metadata = { title: "Admin · Outreach delivery" };
export const dynamic = "force-dynamic";

const PERIODS = [7, 14, 30, 90] as const;
const LEVEL_STYLE = { ok: "bg-green-50 text-green-900", warn: "bg-amber-50 text-amber-900", bad: "bg-red-50 text-red-900" } as const;
const LEVEL_ICON = { ok: "✅", warn: "⚠️", bad: "❌" } as const;
const DAILY_METRICS = [
  ["pushed", "Handed over"],
  ["email-sent", "Sent"],
  ["email-opened", "Opens"],
  ["email-link-clicked", "Clicks"],
  ["reply-received", "Replies"],
  ["email-bounced", "Bounces"],
  ["prospect-unsubscribed", "Unsub."],
] as const;

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

export default async function AdminOutreachDeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.days) ? sp.days[0] : sp.days);
  const days = (PERIODS as readonly number[]).includes(raw) ? raw : 30;
  const supabase = await createClient();

  const [stats, daily, lastEvent, failed, bounces, recent, pushEnabled] = await Promise.all([
    supabase.rpc("outreach_delivery_stats", { p_days: days }),
    supabase.rpc("outreach_delivery_daily", { p_days: Math.min(days, 14) }),
    supabase.from("outreach_events").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("outreach_sends").select("id, error, attempts, created_at, outreach_contacts(email)").eq("status", "push_failed").order("created_at", { ascending: false }).limit(20),
    supabase.from("outreach_events").select("id, email, occurred_at, created_at, detail").eq("event", "email-bounced").order("created_at", { ascending: false }).limit(20),
    supabase.from("outreach_events").select("id, event, email, occurred_at, created_at").order("created_at", { ascending: false }).limit(25),
    isPushEnabled(),
  ]);
  if (stats.error) throw new Error("Could not load the delivery numbers. Has SQL 052 been run?");

  const rows: DeliveryRow[] = ((stats.data ?? []) as Record<string, unknown>[]).map(toDeliveryRow);
  const total = sumDelivery(rows);
  const lastEventAt = (lastEvent.data?.created_at as string | undefined) ?? null;
  const health = deliveryHealth(total, { lastEventAt, pushEnabled });

  // day x metric table
  const byDay = new Map<string, Record<string, number>>();
  for (const r of (daily.data ?? []) as { day: string; metric: string; n: number | string }[]) {
    const cell = byDay.get(r.day) ?? {};
    cell[r.metric] = Number(r.n) || 0;
    byDay.set(r.day, cell);
  }
  const dayKeys = [...byDay.keys()].sort().reverse();

  const cards: [string, number, string][] = [
    ["Handed to Saleshandy", total.handed_over, pct(total.handed_over, total.total) + " of " + total.total],
    ["Sent (confirmed)", total.sent, pct(total.sent, total.handed_over) + " of handed over"],
    ["Opened", total.opened, pct(total.opened, total.sent) + " of sent"],
    ["Link clicked", total.clicked, pct(total.clicked, total.sent) + " of sent"],
    ["Replied", total.replied, pct(total.replied, total.sent) + " of sent"],
    ["Bounced", total.bounced, pct(total.bounced, total.sent) + " of sent"],
    ["Unsubscribed", total.unsubscribed, pct(total.unsubscribed, total.sent) + " of sent"],
    ["Failed to hand over", total.push_failed, total.queued > 0 ? `${total.queued} waiting` : "none waiting"],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-medium">Delivery report</h1>
          <p className="text-sm text-muted">What happened to the emails handed to Saleshandy. Numbers come from Saleshandy&apos;s webhook events, so they are only as complete as that webhook.</p>
        </div>
        <nav aria-label="Period" className="flex gap-2 text-sm">
          {PERIODS.map((d) => (
            <Link key={d} href={`/admin/outreach/delivery?days=${d}`} className={`rounded-chip border border-line px-3 py-1 ${d === days ? "bg-gray-100 font-medium" : ""}`}>{d} days</Link>
          ))}
        </nav>
      </div>

      <section aria-label="Findings" className="space-y-2">
        {health.map((h, i) => (
          <p key={i} className={`rounded-chip p-3 text-sm ${LEVEL_STYLE[h.level]}`}>{LEVEL_ICON[h.level]} {h.text}</p>
        ))}
        <p className="text-xs text-muted">Last webhook event received: {lastEventAt ? lastEventAt.replace("T", " ").slice(0, 16) + " UTC" : "never"}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-chip border border-line bg-white p-3 text-sm">
            <p className="text-xs text-muted">{label}</p>
            <p className="font-display text-xl">{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted">
        Opens are an estimate: some mail apps load images automatically (counting an open nobody made) and others block them (hiding a real one), and Saleshandy only reports opens when open tracking is on. Replies, bounces and unsubscribes are exact. Saleshandy does not report spam complaints.
      </p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">By campaign (last {days} days)</h2>
        {rows.length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">No sends in this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="p-2">Campaign</th><th className="p-2">Handed</th><th className="p-2">Sent</th><th className="p-2">Opened</th><th className="p-2">Clicked</th>
                  <th className="p-2">Replied</th><th className="p-2">Bounced</th><th className="p-2">Unsub.</th><th className="p-2">Failed</th><th className="p-2">Stuck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.campaign_id ?? r.campaign_name}>
                    <td className="p-2">{r.campaign_name}</td>
                    <td className="p-2">{r.handed_over}</td>
                    <td className="p-2">{r.sent}</td>
                    <td className="p-2">{r.opened} <span className="text-xs text-muted">({pct(r.opened, r.sent)})</span></td>
                    <td className="p-2">{r.clicked}</td>
                    <td className="p-2">{r.replied}</td>
                    <td className="p-2">{r.bounced} <span className="text-xs text-muted">({pct(r.bounced, r.sent)})</span></td>
                    <td className="p-2">{r.unsubscribed}</td>
                    <td className="p-2">{r.push_failed}</td>
                    <td className="p-2">{r.stuck}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">Stuck = handed over more than 2 days ago, still no &quot;sent&quot; confirmation. Failed = could not be handed to Saleshandy at all.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Day by day (UTC, last {Math.min(days, 14)} days)</h2>
        {dayKeys.length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr><th className="p-2">Day</th>{DAILY_METRICS.map(([, label]) => <th key={label} className="p-2">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dayKeys.map((d) => (
                  <tr key={d}>
                    <td className="p-2">{d}</td>
                    {DAILY_METRICS.map(([key]) => <td key={key} className="p-2">{byDay.get(d)?.[key] ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Failed hand-overs</h2>
        {(failed.data ?? []).length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(failed.data ?? []).map((f) => {
              const contact = f.outreach_contacts as unknown as { email?: string } | { email?: string }[] | null;
              const email = Array.isArray(contact) ? contact[0]?.email : contact?.email;
              return (
                <li key={f.id as string} className="p-3">
                  <p className="font-medium">{email ?? "(contact deleted)"} <span className="text-xs text-muted">· attempt {f.attempts as number} · {str(f.created_at, 10)}</span></p>
                  <p className="text-xs text-red-800">{str(f.error, 300) || "No reason recorded."}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Recent bounces</h2>
        {(bounces.data ?? []).length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(bounces.data ?? []).map((b) => (
              <li key={b.id as string} className="p-3">
                <p className="font-medium">{b.email as string} <span className="text-xs text-muted">· {str(b.occurred_at ?? b.created_at, 16).replace("T", " ")}</span></p>
                <p className="text-xs text-muted">{str((b.detail as Record<string, unknown> | null)?.bounce_reason, 300) || "No reason given."} · the address is now on the do-not-email list</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Latest webhook events</h2>
        {(recent.data ?? []).length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">No webhook event has arrived yet. After your first test send, events should appear here within minutes.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(recent.data ?? []).map((e) => (
              <li key={e.id as string} className="flex flex-wrap justify-between gap-2 p-2">
                <span>{e.event as string} · {e.email as string}</span>
                <span className="text-xs text-muted">{str(e.occurred_at ?? e.created_at, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
