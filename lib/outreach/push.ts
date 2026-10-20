import { createServiceClient } from "@/lib/supabase/service";
import { getBdtPerUsd } from "@/lib/exchange-rate";
import { sanitizeError } from "@/lib/task-utils";
import { assignListings, BOUNCE_MIN_SAMPLE, buildListingFields, planPushQuota, shouldAutoPause, type ListingSite } from "@/lib/outreach/campaign";
import { buildImportPayload, parseImportResponse, type PushRow } from "@/lib/outreach/saleshandy";
import { decryptApiKey, loadConnection, shRequest } from "@/lib/outreach/saleshandy-server";
import { getSenderIdentity, isPushEnabled, startOfUtcDay, chunk } from "@/lib/outreach/server";
import { senderIsComplete } from "@/lib/outreach/sender";
import { isEncryptionConfigured } from "@/lib/api-providers";

/**
 * The daily hand-over to Saleshandy (Batch 16B-2). For each ACTIVE campaign it picks the next eligible contacts
 * (active, not on the do-not-email list, never given to this campaign), within the campaign's daily limit and the
 * global ceiling, records them first (so two runs can never hand over the same person twice), then sends them to
 * Saleshandy's import. Saleshandy does the actual emailing from the mailboxes you connected there.
 */
export interface CampaignResult {
  campaignId: string;
  name: string;
  pushed: number;
  failed: number;
  note: string | null;
}

export type PushRun = { ok: true; results: CampaignResult[] } | { ok: false; error: string };

const CHUNK = 50;
const MAX_ATTEMPTS = 3;
const SENT_LIKE = ["sent", "finished", "replied", "unsubscribed", "bounced"];

interface CampaignRow {
  id: string;
  name: string;
  step_id: string;
  daily_cap: number;
  site_ids: string[];
  next_site_index: number;
}

export async function runOutreachPush(opts: { campaignId?: string } = {}): Promise<PushRun> {
  const service = createServiceClient();

  if (!(await isPushEnabled(service))) return { ok: false, error: "Sending is switched off. Turn it on in Outreach > Overview first." };
  if (!senderIsComplete(await getSenderIdentity(service))) return { ok: false, error: "Save your sender name and postal address first (Outreach > Overview)." };
  if (!isEncryptionConfigured()) return { ok: false, error: "PROVIDER_KEY_ENCRYPTION_SECRET is not set." };
  const conn = await loadConnection(service);
  const apiKey = conn ? decryptApiKey(conn) : null;
  if (!conn || !apiKey) return { ok: false, error: "Connect Saleshandy first (Outreach > Saleshandy)." };
  if (!conn.field_map?.email) return { ok: false, error: "Save the Saleshandy field ids first (Outreach > Saleshandy)." };

  let q = service.from("outreach_campaigns").select("id, name, step_id, daily_cap, site_ids, next_site_index").eq("status", "active").order("created_at", { ascending: true });
  if (opts.campaignId) q = q.eq("id", opts.campaignId);
  const { data: campaigns, error } = await q;
  if (error) return { ok: false, error: "Could not load campaigns." };
  if (!campaigns || campaigns.length === 0) return { ok: false, error: opts.campaignId ? "That campaign is not active." : "No active campaigns." };

  const today = startOfUtcDay();
  const { count: allTodayCount } = await service.from("outreach_sends").select("id", { count: "exact", head: true }).gte("pushed_at", today);
  let allToday = allTodayCount ?? 0;
  const bdtPerUsd = await getBdtPerUsd(service);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com").replace(/\/+$/, "");
  const results: CampaignResult[] = [];

  for (const c of campaigns as CampaignRow[]) {
    const result: CampaignResult = { campaignId: c.id, name: c.name, pushed: 0, failed: 0, note: null };
    results.push(result);
    try {
      // 1. Safety: pause automatically when too many recent emails bounced.
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const [{ count: sentCount }, { count: bouncedCount }] = await Promise.all([
        service.from("outreach_sends").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", SENT_LIKE).gte("pushed_at", since),
        service.from("outreach_sends").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "bounced").gte("pushed_at", since),
      ]);
      const pause = shouldAutoPause(sentCount ?? 0, bouncedCount ?? 0);
      if (pause.pause) {
        const reason = `Auto-paused: ${(pause.rate * 100).toFixed(1)}% of the last ${sentCount} emails bounced (limit 3%, judged from ${BOUNCE_MIN_SAMPLE} sent). Check the list quality, then resume.`;
        await service.from("outreach_campaigns").update({ status: "paused", pause_reason: reason, updated_at: new Date().toISOString() }).eq("id", c.id);
        result.note = reason;
        continue;
      }

      // 2. Today's quota.
      const { count: todayCount } = await service.from("outreach_sends").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).gte("pushed_at", today);
      let quota = planPushQuota({ dailyCap: c.daily_cap, campaignToday: todayCount ?? 0, allToday });
      if (quota <= 0) {
        result.note = "Daily limit already reached.";
        continue;
      }

      // 3. Earlier failures first (a few attempts at most), then new contacts.
      const { data: retries } = await service
        .from("outreach_sends")
        .select("id, contact_id, site_id, attempts")
        .eq("campaign_id", c.id)
        // Failed hand-overs, and rows recorded but never sent (a run that was cut off): tried again, a few times at most.
        .or(`status.eq.push_failed,and(status.eq.queued,created_at.lt.${new Date(Date.now() - 3_600_000).toISOString()})`)
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(quota);
      const retryRows = retries ?? [];
      const fresh = quota - retryRows.length;

      type Target = { sendId: string; contactId: string; siteId: string | null; attempts: number };
      const targets: Target[] = retryRows.map((r) => ({ sendId: r.id as string, contactId: r.contact_id as string, siteId: (r.site_id as string | null) ?? null, attempts: r.attempts as number }));

      let nextIndex = c.next_site_index;
      if (fresh > 0) {
        const { data: picked, error: pickErr } = await service.rpc("outreach_next_contacts", { p_campaign: c.id, p_limit: fresh });
        if (pickErr) throw new Error("Could not pick contacts");
        const contacts = (picked ?? []) as { id: string }[];
        if (contacts.length > 0) {
          const { assigned, nextIndex: ni } = assignListings(contacts.length, c.site_ids, c.next_site_index);
          nextIndex = ni;
          const { data: claimed, error: claimErr } = await service
            .from("outreach_sends")
            .upsert(contacts.map((ct, i) => ({ campaign_id: c.id, contact_id: ct.id, site_id: assigned[i], status: "queued", attempts: 0 })), { onConflict: "campaign_id,contact_id", ignoreDuplicates: true })
            .select("id, contact_id, site_id");
          if (claimErr) throw new Error("Could not record the contacts");
          for (const r of claimed ?? []) targets.push({ sendId: r.id as string, contactId: r.contact_id as string, siteId: (r.site_id as string | null) ?? null, attempts: 0 });
        }
      }
      if (targets.length === 0) {
        result.note = "No eligible contacts left for this campaign.";
        continue;
      }

      // 4. Details for the email: contacts and listings.
      const contactIds = targets.map((t) => t.contactId);
      const { data: contactRows } = await service.from("outreach_contacts").select("id, email, full_name, company, website").in("id", contactIds);
      const contactById = new Map((contactRows ?? []).map((r) => [r.id as string, r]));
      const siteIds = [...new Set(targets.map((t) => t.siteId).filter((s): s is string => !!s))];
      const siteById = new Map<string, ListingSite>();
      if (siteIds.length > 0) {
        const { data: sites } = await service.from("sites").select("id, domain, niche, da, dr, organic_traffic, price_amount").in("id", siteIds).eq("status", "approved");
        for (const s of sites ?? []) siteById.set(s.id as string, s as unknown as ListingSite);
      }

      // 5. Hand over in small groups.
      let abort: string | null = null;
      for (const group of chunk(targets, CHUNK)) {
        const ids = group.map((g) => g.sendId);
        if (abort) {
          // Not attempted at all: no attempt is counted, so they are tried again next time.
          await service.from("outreach_sends").update({ status: "push_failed", error: abort.slice(0, 500) }).in("id", ids);
          result.failed += group.length;
          continue;
        }
        const rows: PushRow[] = [];
        for (const t of group) {
          const ct = contactById.get(t.contactId);
          if (!ct) continue;
          const [first, ...rest] = String(ct.full_name ?? "").trim().split(/\s+/);
          const site = t.siteId ? siteById.get(t.siteId) : undefined;
          const listing = site ? buildListingFields(site, { bdtPerUsd, siteUrl }) : null;
          rows.push({ email: ct.email as string, firstName: first || null, lastName: rest.join(" ") || null, company: (ct.company as string | null) ?? null, website: (ct.website as string | null) ?? null, ...(listing ?? {}) });
        }
        let ok = false;
        let ref: string | null = null;
        let message = "";
        try {
          const res = await shRequest(apiKey, "/prospects/import", { method: "POST", body: buildImportPayload({ stepId: c.step_id, rows, fieldMap: conn.field_map }) });
          const parsed = parseImportResponse(res.status, res.json);
          ok = parsed.ok;
          ref = parsed.requestRef;
          message = parsed.message;
          if (res.status === 401 || res.status === 403) abort = "Saleshandy rejected the API key.";
        } catch (err) {
          message = sanitizeError(err, 200);
        }
        // Rows with the same number of earlier attempts are updated together (usually one update per group).
        const byAttempts = new Map<number, string[]>();
        for (const t of group) byAttempts.set(t.attempts, [...(byAttempts.get(t.attempts) ?? []), t.sendId]);
        const now = new Date().toISOString();
        for (const [attempts, sendIds] of byAttempts) {
          await service
            .from("outreach_sends")
            .update(ok ? { status: "pushed", pushed_at: now, request_ref: ref, error: null, attempts: attempts + 1 } : { status: "push_failed", error: message.slice(0, 500), attempts: attempts + 1 })
            .in("id", sendIds);
        }
        if (ok) {
          result.pushed += group.length;
          allToday += group.length;
        } else {
          result.failed += group.length;
          result.note = message.slice(0, 200);
        }
      }

      await service
        .from("outreach_campaigns")
        .update({ next_site_index: nextIndex, last_push_at: new Date().toISOString(), last_push_summary: { pushed: result.pushed, failed: result.failed, note: result.note }, updated_at: new Date().toISOString() })
        .eq("id", c.id);
    } catch (err) {
      result.note = sanitizeError(err, 200);
    }
  }
  return { ok: true, results };
}
