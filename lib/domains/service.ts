import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { validateHostname } from "@/lib/domains/hostname";
import { checkTxtOwnership, checkPointsToPlatform, nodeResolver, txtFailureMessage, type DnsResolver } from "@/lib/domains/dns";
import * as vercel from "@/lib/domains/vercel";
import { clearDomainCache } from "@/lib/domains/resolve";
import { getLinkBlocklist, getLinkLimits, ownHosts } from "@/lib/links/server";
import { validateDestinationUrl } from "@/lib/links/url";
import type { ServiceResult } from "@/lib/links/service";

/** Custom-domain lifecycle (Batch 11): add -> prove DNS ownership -> connect -> active. Service client AFTER the caller proved the user. */
export const DOMAIN_COLUMNS =
  "id, user_id, hostname, status, verify_token, root_redirect_url, verified_at, connected_at, last_checked_at, last_error, vercel_added, disabled_note, created_at";

const fail = (status: number, error: string, field?: string): { ok: false; status: number; error: string; field?: string } => ({ ok: false, status, error, field });

/** "automatic" = a Vercel token is configured, so domains are connected without manual work. */
export function connectionMode(): "automatic" | "manual" {
  return vercel.getVercelConfig() ? "automatic" : "manual";
}

export async function addDomain(userId: string, isAdmin: boolean, rawHostname: string): Promise<ServiceResult<Record<string, unknown>>> {
  const blocklist = await getLinkBlocklist();
  const v = validateHostname(rawHostname, { ownHosts: ownHosts(), blockedDomains: blocklist.domains });
  if (!v.ok) return fail(400, v.message, "hostname");

  const svc = createServiceClient();
  if (!isAdmin) {
    const limits = await getLinkLimits();
    if (limits.domain_max_per_user === 0) return fail(403, "Custom domains are not available right now.");
    const { count } = await svc.from("custom_domains").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= limits.domain_max_per_user) return fail(403, `You can connect up to ${limits.domain_max_per_user} custom domain(s).`);
  }

  // Someone else already owns it (verified/active/disabled)? Say so without revealing who.
  const { data: owned } = await svc.from("custom_domains").select("id, user_id").eq("hostname", v.hostname).neq("status", "pending").maybeSingle();
  if (owned && owned.user_id !== userId) return fail(409, "This domain is already connected to another LinkLazy account.", "hostname");

  const { data, error } = await svc
    .from("custom_domains")
    .insert({ user_id: userId, hostname: v.hostname, verify_token: randomBytes(16).toString("hex") })
    .select(DOMAIN_COLUMNS)
    .single();
  if (error?.code === "23505") return fail(409, "You have already added this domain.", "hostname");
  if (error || !data) return fail(500, "Could not add the domain. Please try again.");
  return { ok: true, data };
}

async function load(id: string, userId: string | null) {
  const svc = createServiceClient();
  let q = svc.from("custom_domains").select(DOMAIN_COLUMNS).eq("id", id);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.maybeSingle();
  return data as null | {
    id: string; user_id: string; hostname: string; status: string; verify_token: string; vercel_added: boolean;
    root_redirect_url: string | null; last_error: string | null;
  };
}

/**
 * Re-runs every check for one domain. Safe to call repeatedly (the "Check again" button).
 * pending -> verified (TXT proven, and the hostname is not owned by someone else)
 * verified -> active  (automatic mode: Vercel reports DNS correct; manual mode: an admin confirms)
 */
export async function verifyDomainNow(
  userId: string,
  id: string,
  resolver?: DnsResolver
): Promise<ServiceResult<Record<string, unknown>>> {
  const row = await load(id, userId);
  if (!row) return fail(404, "Domain not found.");
  if (row.status === "disabled") return fail(403, "This domain was disabled by an administrator.");

  const svc = createServiceClient();
  const dns = resolver ?? (await nodeResolver());
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_checked_at: now, updated_at: now };
  let status = row.status;

  if (status === "pending") {
    const txt = await checkTxtOwnership(row.hostname, row.verify_token, dns);
    if (!txt.ok) {
      patch.last_error = txtFailureMessage(txt.reason);
    } else {
      // First verified claim wins; the partial unique index enforces it even under a race.
      const { error } = await svc.from("custom_domains").update({ ...patch, status: "verified", verified_at: now, last_error: null }).eq("id", id).eq("user_id", userId);
      if (error?.code === "23505") {
        await svc.from("custom_domains").update({ ...patch, last_error: "This domain was verified by another account first." }).eq("id", id);
      } else if (error) return fail(500, "Could not save the check result. Please try again.");
      else status = "verified";
      if (status !== "verified") {
        const fresh = await load(id, userId);
        return { ok: true, data: fresh as unknown as Record<string, unknown> };
      }
      Object.assign(patch, { last_error: null });
    }
  }

  if (status === "verified") {
    const cfg = vercel.getVercelConfig();
    if (cfg) {
      const add = await vercel.addDomain(cfg, row.hostname);
      if (!add.ok) {
        patch.last_error = add.status === 409 ? "This domain is attached to another hosting project. Remove it there first." : `Could not connect the domain automatically: ${add.message}`;
      } else {
        patch.vercel_added = true;
        const conf = await vercel.getDomainConfig(cfg, row.hostname);
        if (conf.ok && !conf.data.misconfigured) {
          status = "active";
          patch.connected_at = now;
          patch.last_error = null;
        } else if (conf.ok) {
          patch.last_error = "Ownership is confirmed. Now point your domain to us with the DNS record shown below, then check again.";
        } else patch.last_error = "Could not read the hosting status yet. Please check again in a minute.";
      }
    } else {
      const pointing = await checkPointsToPlatform(row.hostname, dns);
      patch.last_error = pointing.pointing
        ? "Ownership and DNS are confirmed. Waiting for our team to finish the connection."
        : "Ownership is confirmed. Now point your domain to us with the DNS record shown below.";
    }
  }

  const { data, error } = await svc.from("custom_domains").update({ ...patch, status }).eq("id", id).eq("user_id", userId).select(DOMAIN_COLUMNS).single();
  if (error || !data) return fail(500, "Could not save the check result. Please try again.");
  clearDomainCache();
  return { ok: true, data };
}

export async function updateDomainRoot(userId: string, id: string, rawUrl: string | null): Promise<ServiceResult<Record<string, unknown>>> {
  const row = await load(id, userId);
  if (!row) return fail(404, "Domain not found.");
  let root: string | null = null;
  if (rawUrl && rawUrl.trim()) {
    const blocklist = await getLinkBlocklist();
    const v = validateDestinationUrl(rawUrl, { ownHosts: ownHosts(), blockedDomains: blocklist.domains });
    if (!v.ok) return fail(400, v.message, "root_redirect_url");
    // A landing redirect that points back at the same custom domain would loop.
    if (v.host === row.hostname) return fail(400, "The landing page cannot be this same domain.", "root_redirect_url");
    root = v.url;
  }
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("custom_domains")
    .update({ root_redirect_url: root, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select(DOMAIN_COLUMNS)
    .single();
  if (error || !data) return fail(500, "Could not save changes. Please try again.");
  clearDomainCache();
  return { ok: true, data };
}

/** Removes the domain; also detaches it from the hosting project when we attached it. */
export async function removeDomain(userId: string | null, id: string): Promise<ServiceResult<null>> {
  const row = await load(id, userId);
  if (!row) return fail(404, "Domain not found.");
  const svc = createServiceClient();
  if (row.vercel_added) {
    const cfg = vercel.getVercelConfig();
    if (cfg) {
      const res = await vercel.removeDomain(cfg, row.hostname);
      if (!res.ok) return fail(502, "Could not detach the domain from hosting. Please try again in a minute.");
    }
  }
  let del = svc.from("custom_domains").delete().eq("id", id);
  if (userId) del = del.eq("user_id", userId);
  const { error } = await del;
  if (error) return fail(500, "Could not remove the domain.");
  clearDomainCache();
  return { ok: true, data: null };
}

/** Admin: switch off / on, or confirm the manual connection (manual mode). */
export async function adminSetDomainStatus(
  id: string,
  action: "disable" | "enable" | "mark_active",
  note: string | null
): Promise<ServiceResult<Record<string, unknown>>> {
  const row = await load(id, null);
  if (!row) return fail(404, "Domain not found.");
  const svc = createServiceClient();
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (action === "disable") patch = { status: "disabled", disabled_note: note?.slice(0, 300) ?? null, updated_at: now };
  else if (action === "enable") patch = { status: "verified", disabled_note: null, updated_at: now, last_error: "Re-enabled by an administrator. Check again to activate." };
  else {
    if (row.status !== "verified") return fail(400, "Only a domain with confirmed ownership can be marked active.");
    patch = { status: "active", connected_at: now, last_error: null, updated_at: now };
  }
  const { data, error } = await svc.from("custom_domains").update(patch).eq("id", id).select(DOMAIN_COLUMNS).single();
  if (error || !data) return fail(500, "Could not update the domain.");
  clearDomainCache();
  return { ok: true, data };
}
