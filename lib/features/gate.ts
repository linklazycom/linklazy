import { normalizeFlag } from "@/lib/flag-value";
import { TOOL_FLAG_KEYS } from "@/lib/features/registry";

/**
 * Reads the tool switches for the request gate in proxy middleware. Plain fetch to the Supabase REST API with the server key
 * (no extra client), kept in memory for 15 seconds so a busy site does not query the settings on every request. That means a
 * switch change reaches every visitor within about 15 seconds. If the settings cannot be read, everything stays ON (fail open).
 */
const TTL_MS = 15_000;
let cache: { at: number; flags: Record<string, boolean> } | null = null;

export function clearToolFlagCache() {
  cache = null;
}

export async function getToolFlags(): Promise<Record<string, boolean>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.flags;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return cache?.flags ?? {};
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${url}/rest/v1/site_settings?select=key,value&key=in.(${TOOL_FLAG_KEYS.join(",")})`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return cache?.flags ?? {};
    const rows = (await res.json()) as { key: string; value: unknown }[];
    const flags: Record<string, boolean> = {};
    for (const k of TOOL_FLAG_KEYS) flags[k] = true;
    for (const r of rows) if (TOOL_FLAG_KEYS.includes(r.key)) flags[r.key] = normalizeFlag(r.value, true);
    cache = { at: Date.now(), flags };
    return flags;
  } catch {
    return cache?.flags ?? {};
  }
}
