import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OutreachSenderForm } from "@/components/admin/outreach/settings-form";
import { PushSwitch } from "@/components/admin/outreach/push-switch";
import { SuppressionManager } from "@/components/admin/outreach/suppression-manager";
import { daysAgoIso, getSenderIdentity, isPushEnabled } from "@/lib/outreach/server";
import { loadConnection } from "@/lib/outreach/saleshandy-server";
import { senderIsComplete } from "@/lib/outreach/sender";
import { CONTACT_SOURCES, CONTACT_STATUSES, HOLD_REASONS, HOLD_REASON_LABELS } from "@/lib/outreach/rules";

export const metadata = { title: "Admin · Outreach" };
export const dynamic = "force-dynamic";

export default async function AdminOutreachPage() {
  const supabase = await createClient();
  const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: c } = await build(base());
    return c ?? 0;
  };
  function base() {
    return supabase.from("outreach_contacts").select("id", { count: "exact", head: true });
  }

  const since7 = daysAgoIso(7);
  const [statusCounts, heldCounts, imports, suppressions, suppressionTotal, sender, conn, enabled, activeCampaigns, eventsWeek, newTickets] = await Promise.all([
    Promise.all(CONTACT_STATUSES.map((s) => count((q) => q.eq("status", s)))),
    Promise.all(HOLD_REASONS.map((r) => count((q) => q.eq("status", "held").eq("hold_reason", r)))),
    supabase.from("outreach_imports").select("id, file_name, source, total_rows, added, held, invalid, duplicates, suppressed, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("outreach_suppressions").select("id, email, reason, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("outreach_suppressions").select("id", { count: "exact", head: true }),
    getSenderIdentity(),
    loadConnection(),
    isPushEnabled(),
    supabase.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("outreach_events").select("id", { count: "exact", head: true }).gte("created_at", since7),
    supabase.from("outreach_tickets").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const total = statusCounts.reduce((a, b) => a + b, 0);
  const senderReady = senderIsComplete(sender);
  const keySaved = !!conn?.api_key_encrypted;
  const fieldsSaved = !!conn?.field_map?.email;
  const sourceLabel = (id: string) => CONTACT_SOURCES.find((s) => s.id === id)?.label ?? id;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Outreach</h1>
        <p className="text-sm text-muted">Your contact list, the safety rules around it, the do-not-email list and the Saleshandy campaigns. LinkLazy hands each day&apos;s batch to Saleshandy; Saleshandy sends the emails.</p>
      </div>

      <nav aria-label="Reports" className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/outreach/delivery" className="underline">Delivery report (sent, opened, bounced, failed)</Link>
        <Link href="/admin/outreach/tickets" className="underline">Replies{newTickets.count ? ` (${newTickets.count} new)` : ""}</Link>
      </nav>

      <section className="space-y-2 rounded-chip border border-line bg-white p-5">
        <h2 className="font-display text-lg font-medium">Ready to send?</h2>
        <ul className="space-y-1 text-sm">
          <li>{senderReady ? "✅" : "❌"} Sender name and postal address saved {senderReady ? "" : "— fill in the form below"}</li>
          <li>{total > 0 ? "✅" : "⬜"} Contacts imported ({total}) — <Link href="/admin/outreach/import" className="underline">import</Link></li>
          <li>{keySaved ? "✅" : "❌"} Saleshandy API key saved — <Link href="/admin/outreach/saleshandy" className="underline">connection</Link></li>
          <li>{fieldsSaved ? "✅" : "❌"} Saleshandy field ids saved</li>
          <li>{(eventsWeek.count ?? 0) > 0 ? "✅" : "⬜"} Webhook events received in the last 7 days ({eventsWeek.count ?? 0}) — proves the webhook works</li>
          <li>{(activeCampaigns.count ?? 0) > 0 ? "✅" : "⬜"} An active campaign — <Link href="/admin/outreach/campaigns" className="underline">campaigns</Link></li>
          <li>⬜ Email template pasted into your Saleshandy sequence and tested on yourself — <Link href="/admin/outreach/template" className="underline">template</Link></li>
        </ul>
      </section>

      <PushSwitch enabled={enabled} ready={keySaved && fieldsSaved && senderReady} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Contacts by status</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/outreach/import" className="underline">Import contacts</Link>
            <Link href="/admin/outreach/contacts" className="underline">Open the list</Link>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {CONTACT_STATUSES.map((s, i) => (
            <li key={s} className="rounded-chip border border-line bg-white p-3 text-sm">
              <Link href={`/admin/outreach/contacts?status=${s}`} className="underline">{s}</Link>
              <p className="font-display text-xl">{statusCounts[i]}</p>
              {s === "held" && heldCounts.some((c) => c > 0) && (
                <p className="text-xs text-muted">
                  {HOLD_REASONS.map((r, j) => (heldCounts[j] > 0 ? `${HOLD_REASON_LABELS[r]}: ${heldCounts[j]}` : null)).filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <OutreachSenderForm initial={sender} />

      <SuppressionManager rows={(suppressions.data ?? []) as { id: string; email: string; reason: string; created_at: string }[]} total={suppressionTotal.count ?? 0} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Recent imports</h2>
        {(imports.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(imports.data ?? []).map((i) => (
              <li key={i.id} className="p-3">
                <p className="font-medium">{i.file_name ?? "Pasted list"} · {String(i.created_at).slice(0, 10)}</p>
                <p className="text-xs text-muted">
                  {i.added} added of {i.total_rows} rows · {i.held} held · {i.invalid} invalid · {i.duplicates} duplicates · {i.suppressed} on the do-not-email list · source: {sourceLabel(i.source)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
