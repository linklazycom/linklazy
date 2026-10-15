import { createServiceClient } from "@/lib/supabase/service";
import { getFlags } from "@/lib/feature-flags";
import { resolveLimits, LINK_LIMIT_DEFS, type LinkLimits } from "@/lib/links/limits";

/** Server-only helpers for Link Management (Batch 9): config, blocklist and flag lookups with short in-memory caches. */
export const LINK_FEATURE_FLAG = "feature_link_management";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com").replace(/\/+$/, "");
}

export function shortUrlFor(slug: string, src?: "qr"): string {
  return `${siteUrl()}/l/${slug}${src ? `?src=${src}` : ""}`;
}

export function ownHosts(): string[] {
  try {
    const host = new URL(siteUrl()).hostname.toLowerCase();
    const bare = host.replace(/^www\./, "");
    return Array.from(new Set([host, bare, `www.${bare}`]));
  } catch {
    return ["linklazy.com", "www.linklazy.com"];
  }
}

function ttlCache<T>(ms: number, load: () => Promise<T>) {
  let value: T | undefined;
  let at = 0;
  return {
    async get(): Promise<T> {
      if (value !== undefined && Date.now() - at < ms) return value;
      const fresh = await load();
      value = fresh;
      at = Date.now();
      return fresh;
    },
    clear() {
      value = undefined;
      at = 0;
    },
  };
}

const limitsCache = ttlCache<LinkLimits>(30_000, async () => {
  const svc = createServiceClient();
  const { data } = await svc
    .from("site_settings")
    .select("key, value")
    .in("key", LINK_LIMIT_DEFS.map((d) => d.key));
  return resolveLimits(data);
});

export interface LinkBlocklist {
  domains: string[];
  slugs: string[];
}

const blocklistCache = ttlCache<LinkBlocklist>(60_000, async () => {
  const svc = createServiceClient();
  const { data } = await svc.from("link_blocklist").select("kind, value").limit(5000);
  const domains: string[] = [];
  const slugs: string[] = [];
  for (const r of data ?? []) {
    if (r.kind === "domain") domains.push(String(r.value).toLowerCase());
    else if (r.kind === "slug") slugs.push(String(r.value).toLowerCase());
  }
  return { domains, slugs };
});

const featureCache = ttlCache<boolean>(20_000, async () => {
  const flags = await getFlags([LINK_FEATURE_FLAG]);
  return flags[LINK_FEATURE_FLAG] !== false;
});

export const getLinkLimits = () => limitsCache.get();

export async function getLinkBlocklist(): Promise<LinkBlocklist> {
  try {
    return await blocklistCache.get();
  } catch {
    return { domains: [], slugs: [] };
  }
}

export async function isLinkFeatureOn(): Promise<boolean> {
  try {
    return await featureCache.get();
  } catch {
    return true;
  }
}

/** Called after an admin changes settings/blocklist so THIS instance sees it immediately (others within ~1 min). */
export function clearLinkConfigCache() {
  limitsCache.clear();
  blocklistCache.clear();
  featureCache.clear();
}
