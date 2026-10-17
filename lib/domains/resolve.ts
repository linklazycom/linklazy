import { createServiceClient } from "@/lib/supabase/service";

/**
 * Hot-path lookup: "which user owns this ACTIVE custom domain?" (Batch 11).
 * Cached in memory for a short time so a busy domain costs one query per ~30 s per instance;
 * an admin disabling a domain takes effect within that window (and immediately on the instance
 * that handled the change, via clearDomainCache()).
 */
export interface ActiveDomain {
  id: string;
  user_id: string;
  hostname: string;
  root_redirect_url: string | null;
}

const HIT_TTL_MS = 30_000;
const MISS_TTL_MS = 10_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { value: ActiveDomain | null; at: number }>();

export function clearDomainCache() {
  cache.clear();
}

export async function getActiveDomain(hostname: string): Promise<ActiveDomain | null> {
  const key = hostname.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? HIT_TTL_MS : MISS_TTL_MS)) return hit.value;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("custom_domains")
    .select("id, user_id, hostname, root_redirect_url")
    .eq("hostname", key)
    .eq("status", "active")
    .maybeSingle();
  if (error) return hit?.value ?? null; // on a DB hiccup keep serving the last known answer

  const value = (data as ActiveDomain | null) ?? null;
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { value, at: Date.now() });
  return value;
}
