import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueTask, type TaskRow } from "@/lib/tasks";
import { sendEmail } from "@/lib/email";
import { checkPointsToPlatform, checkTxtOwnership, nodeResolver, type DnsResolver, type TxtCheck } from "@/lib/domains/dns";
import { txtRecordName, txtRecordValue } from "@/lib/domains/hostname";
import { clearDomainCache } from "@/lib/domains/resolve";

/**
 * Daily re-check that the owner of a custom domain still controls it (Batch 23B).
 *
 * Why: ownership is proven once, when the domain is added. A domain can later expire and be bought by somebody else, and until now it
 * would stay "active" for the old owner for ever (and nobody else could claim it). The re-check puts such a domain back to "pending".
 *
 * Fairness: the page never told owners to keep the TXT record, so many will have deleted it. A domain therefore passes when EITHER the
 * ownership record is still there OR the domain still points at our hosting. Only when both are missing does it count as a miss, and
 * only 3 misses in a row (3 days) move the domain back to "pending". A failed DNS lookup is never a miss. The owner gets an email at
 * the first miss and again when the domain goes back to pending.
 */
export const DOMAIN_RECHECK_TASK = "domain.recheck";
export const RECHECK_AFTER_HOURS = 20;
export const MISSES_BEFORE_PENDING = 3;

export type RecheckDecision = { outcome: "ok" | "unknown" | "miss"; failures: number; action: "none" | "warn" | "downgrade" };

/** Pure. `pointing` only matters when the TXT record was definitely not found. */
export function decideRecheck(input: { failures: number; txt: TxtCheck; pointing: boolean }): RecheckDecision {
  const before = Math.max(0, Math.floor(input.failures) || 0);
  if (input.txt.ok) return { outcome: "ok", failures: 0, action: "none" };
  if (input.txt.reason === "dns_error") return { outcome: "unknown", failures: before, action: "none" };
  if (input.pointing) return { outcome: "ok", failures: 0, action: "none" };
  const failures = before + 1;
  return { outcome: "miss", failures, action: failures >= MISSES_BEFORE_PENDING ? "downgrade" : failures === 1 ? "warn" : "none" };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: the email the owner gets at the first miss ("warn") and when the domain goes back to pending ("downgrade"). */
export function buildDomainRecheckEmail(kind: "warn" | "downgrade", input: { hostname: string; token: string; siteUrl: string }): { subject: string; html: string } {
  const host = escapeHtml(input.hostname);
  const record = `<p>Ownership record (TXT)<br>Name: <code>${escapeHtml(txtRecordName(input.hostname))}</code><br>Value: <code>${escapeHtml(txtRecordValue(input.token))}</code></p>`;
  const link = `<p><a href="${input.siteUrl}/dashboard/domains">Open your domains</a></p>`;
  if (kind === "warn") {
    return {
      subject: `We could not confirm ownership of ${input.hostname}`,
      html: `<p>Our daily check could not find the ownership record for <strong>${host}</strong>, and the domain no longer seems to point to LinkLazy.</p>${record}<p>Please keep this record in your DNS (or keep the domain pointed at LinkLazy). If we still cannot confirm it for ${MISSES_BEFORE_PENDING} days in a row, the domain goes back to pending and your short links stop using it. They keep working on linklazy.com.</p>${link}`,
    };
  }
  return {
    subject: `${input.hostname} was set back to pending`,
    html: `<p>We could not confirm ownership of <strong>${host}</strong> for ${MISSES_BEFORE_PENDING} days in a row, so it was set back to pending. Your short links no longer use this domain; they keep working on linklazy.com.</p><p>To use it again, add the record below and press &quot;Check again&quot;.</p>${record}${link}`,
  };
}

async function notifyOwner(svc: SupabaseClient, userId: string, kind: "warn" | "downgrade", row: { hostname: string; verify_token: string }): Promise<void> {
  try {
    const { data } = await svc.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return;
    const mail = buildDomainRecheckEmail(kind, { hostname: row.hostname, token: row.verify_token, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  } catch {
    /* the status change never depends on the email */
  }
}

/** Queues one task per domain that is due. Idempotency key (domain + day): a double cron run never checks twice. */
export async function enqueueDueDomainRechecks(limit = 100): Promise<{ due: number; enqueued: number; skipped?: string }> {
  const svc = createServiceClient();
  const before = new Date(Date.now() - RECHECK_AFTER_HOURS * 3_600_000).toISOString();
  const { data, error } = await svc
    .from("custom_domains")
    .select("id, user_id")
    .in("status", ["verified", "active"])
    .or(`last_recheck_at.is.null,last_recheck_at.lt.${before}`)
    .order("last_recheck_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return { due: 0, enqueued: 0, skipped: "sql_071_missing" };
  const day = new Date().toISOString().slice(0, 10);
  let enqueued = 0;
  for (const d of data ?? []) {
    try {
      const r = await enqueueTask({ type: DOMAIN_RECHECK_TASK, userId: d.user_id as string, payload: { domainId: d.id }, idempotencyKey: `domain:${d.id}:${day}`, maxAttempts: 2 });
      if (r.created) enqueued++;
    } catch {
      /* one bad insert must not stop the others */
    }
  }
  return { due: data?.length ?? 0, enqueued };
}

/** Task handler: re-checks one domain. */
export async function handleDomainRecheckTask(task: TaskRow, resolver?: DnsResolver): Promise<Record<string, unknown>> {
  const id = typeof task.payload?.domainId === "string" ? task.payload.domainId : null;
  if (!id) return { skipped: "no_domain_id" };
  const svc = createServiceClient();
  const { data: row, error } = await svc.from("custom_domains").select("id, user_id, hostname, status, verify_token, recheck_failures").eq("id", id).maybeSingle();
  if (error) return { skipped: "sql_071_missing" };
  if (!row) return { skipped: "deleted" };
  if (row.status !== "verified" && row.status !== "active") return { skipped: `status_${row.status}` };

  const dns = resolver ?? (await nodeResolver());
  const txt = await checkTxtOwnership(row.hostname as string, row.verify_token as string, dns);
  const pointing = txt.ok || txt.reason === "dns_error" ? false : (await checkPointsToPlatform(row.hostname as string, dns)).pointing;
  const decision = decideRecheck({ failures: (row.recheck_failures as number) ?? 0, txt, pointing });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_recheck_at: now, recheck_failures: decision.action === "downgrade" ? 0 : decision.failures };
  if (decision.action === "downgrade") {
    Object.assign(patch, {
      status: "pending",
      connected_at: null,
      updated_at: now,
      last_error: `We could not confirm ownership for ${MISSES_BEFORE_PENDING} days in a row. Add the ownership record again, then check again.`,
    });
  }
  // Only touch a domain that is still verified/active (an admin may have disabled it meanwhile).
  const { error: upError } = await svc.from("custom_domains").update(patch).eq("id", id).in("status", ["verified", "active"]);
  if (upError) return { skipped: "update_failed" };
  if (decision.action === "downgrade") clearDomainCache();
  if (decision.action !== "none") await notifyOwner(svc, row.user_id as string, decision.action, { hostname: row.hostname as string, verify_token: row.verify_token as string });
  return { outcome: decision.outcome, failures: decision.failures, action: decision.action };
}
