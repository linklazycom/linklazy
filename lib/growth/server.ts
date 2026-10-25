import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { decideToolAccess, type ToolAccess } from "@/lib/growth/rules";

/**
 * Server helpers shared by the public tools (Batch 18). Every public tool goes through gateToolRequest:
 * the switch first, then the visitor's own limits, and only then (if the work really costs us something) the whole-site ceiling.
 */
export interface ToolGate {
  /** The visitor's IP, as far as the proxy tells us. */
  ip: string;
}

export async function gateToolRequest(
  request: Request,
  opts: { flag: string; bucket: string; perIpHour: number; perIpDay?: number }
): Promise<{ ok: true; gate: ToolGate } | { ok: false; response: ToolAccess & { ok: false } }> {
  const enabled = await isFeatureEnabled(opts.flag);
  const base = { enabled, ipHourOk: true, ipDayOk: true, globalOk: true };
  const first = decideToolAccess(base);
  if (!first.ok) return { ok: false, response: first };

  const ip = getRequestIp(request);
  const hour = await checkRateLimit(`${opts.bucket}_hour`, ip, { max: opts.perIpHour, windowMinutes: 60 });
  const afterHour = decideToolAccess({ ...base, ipHourOk: hour.allowed });
  if (!afterHour.ok) return { ok: false, response: afterHour };

  if (opts.perIpDay !== undefined) {
    const day = await checkRateLimit(`${opts.bucket}_day`, ip, { max: opts.perIpDay, windowMinutes: 1440 });
    const afterDay = decideToolAccess({ ...base, ipDayOk: day.allowed });
    if (!afterDay.ok) return { ok: false, response: afterDay };
  }
  return { ok: true, gate: { ip } };
}

/** The whole-site ceiling for work that costs us something (an Ahrefs call, an outbound page fetch). */
export async function checkGlobalCeiling(bucket: string, max: number): Promise<ToolAccess> {
  const r = await checkRateLimit(`${bucket}_global`, "all", { max, windowMinutes: 1440 });
  return decideToolAccess({ enabled: true, ipHourOk: true, ipDayOk: true, globalOk: r.allowed });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const cacheKey = (name: string, value: string) => createHash("sha256").update(`${name}|v1|${value.toLowerCase()}`).digest("hex");

/** A saved answer younger than `ttlMs`, or null. Uses the shared search_cache table (server-only, no policies). */
export async function readToolCache<T>(name: string, value: string, ttlMs: number = DAY_MS): Promise<T | null> {
  try {
    const { data } = await createServiceClient().from("search_cache").select("results, created_at").eq("cache_key", cacheKey(name, value)).maybeSingle();
    if (data && Date.now() - new Date(data.created_at as string).getTime() < ttlMs) return data.results as T;
  } catch {
    // a cache miss is always safe
  }
  return null;
}

export async function writeToolCache(name: string, value: string, results: unknown, provider: string): Promise<void> {
  try {
    await createServiceClient().from("search_cache").upsert({ cache_key: cacheKey(name, value), results, provider, created_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch {
    // never break the tool because the cache could not be saved
  }
}
