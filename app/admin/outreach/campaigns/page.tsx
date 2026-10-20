import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CampaignActions } from "@/components/admin/outreach/campaign-actions";
import { CampaignForm, type SiteOption } from "@/components/admin/outreach/campaign-form";
import { PushSwitch } from "@/components/admin/outreach/push-switch";
import { loadConnection } from "@/lib/outreach/saleshandy-server";
import { getSenderIdentity, isPushEnabled } from "@/lib/outreach/server";
import { senderIsComplete } from "@/lib/outreach/sender";
import { maskDomain } from "@/lib/mask-domain";

export const metadata = { title: "Admin · Outreach campaigns" };
export const dynamic = "force-dynamic";

const STAT_ORDER = ["pushed", "sent", "replied", "bounced", "unsubscribed", "finished", "push_failed"] as const;

export default async function AdminOutreachCampaignsPage() {
  const supabase = await createClient();
  const [conn, sender, enabled, campaignsRes, sendsRes, sitesRes] = await Promise.all([
    loadConnection(),
    getSenderIdentity(),
    isPushEnabled(),
    supabase.from("outreach_campaigns").select("id, name, status, pause_reason, sequence_id, sequence_name, daily_cap, filter_tag, filter_country, filter_source, site_ids, last_push_at, last_push_summary, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("outreach_sends").select("campaign_id, status").limit(50000),
    supabase.from("sites").select("id, domain, niche, price_amount").eq("status", "approved").order("domain", { ascending: true }).limit(200),
  ]);
  if (campaignsRes.error) throw new Error("Could not load campaigns");

  const stats = new Map<string, Record<string, number>>();
  for (const r of sendsRes.data ?? []) {
    const m = stats.get(r.campaign_id as string) ?? {};
    m[r.status as string] = (m[r.status as string] ?? 0) + 1;
    stats.set(r.campaign_id as string, m);
  }
  const sites: SiteOption[] = (sitesRes.data ?? []).map((s) => ({ id: s.id as string, label: `${maskDomain(String(s.domain))}${s.niche ? ` · ${s.niche}` : ""}` }));
  const connected = !!conn?.api_key_encrypted;
  const ready = connected && !!conn?.field_map?.email && senderIsComplete(sender);

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <h1 className="font-display text-2xl font-medium">Campaigns</h1>

      <PushSwitch enabled={enabled} ready={ready} />

      {(campaignsRes.data ?? []).length === 0 ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">No campaigns yet.</p>
      ) : (
        <ul className="space-y-3">
          {(campaignsRes.data ?? []).map((c) => {
            const st = stats.get(c.id as string) ?? {};
            const last = c.last_push_summary as { pushed?: number; failed?: number; note?: string | null } | null;
            return (
              <li key={c.id} className="space-y-2 rounded-chip border border-line bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {c.name}{" "}
                      <span className={`rounded-chip px-2 py-0.5 text-xs ${c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{c.status}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Sequence: {c.sequence_name ?? c.sequence_id} · {c.daily_cap} per day · {c.site_ids?.length ?? 0} listing(s)
                      {c.filter_tag ? ` · tag ${c.filter_tag}` : ""}
                      {c.filter_country ? ` · ${c.filter_country}` : ""}
                      {c.filter_source ? ` · ${c.filter_source}` : ""}
                    </p>
                  </div>
                  <CampaignActions id={c.id as string} status={c.status as string} />
                </div>
                {c.pause_reason && c.status === "paused" && <p className="text-xs text-amber-800">{c.pause_reason}</p>}
                <p className="text-xs text-muted">
                  {STAT_ORDER.filter((k) => st[k]).map((k) => `${k.replace("_", " ")}: ${st[k]}`).join(" · ") || "Nothing handed to Saleshandy yet."}
                </p>
                {c.last_push_at && (
                  <p className="text-xs text-muted">
                    Last run {String(c.last_push_at).slice(0, 16).replace("T", " ")} UTC: {last?.pushed ?? 0} sent, {last?.failed ?? 0} failed{last?.note ? `. ${last.note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CampaignForm sites={sites} connected={connected} />
    </div>
  );
}
