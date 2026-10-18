/**
 * URL matching for the Backlink Monitor (Batch 13). Pure: tested in tests/backlink-check.test.ts.
 * Two URLs count as "the same page" when scheme (http/https), a leading "www.", a trailing slash,
 * the #fragment and (unless the target itself has one) the query string are the only differences.
 */
const TRACKING_PARAMS = /^(utm_[a-z0-9_]+|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|ref_src|igshid|yclid|_ga)$/i;

export interface UrlKey {
  host: string; // lowercase, no "www."
  path: string; // no trailing slash ("" for the root)
  query: string; // non-tracking params, sorted, "" when none
}

export function hostKey(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function urlKey(url: string): UrlKey | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  params.sort(([a], [b]) => a.localeCompare(b));
  const query = params.map(([k, v]) => `${k}=${v}`).join("&");
  const path = u.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return { host: hostKey(u.hostname), path, query };
}

export type MatchKind = "exact" | "same_domain" | "none";

/** Does a link pointing at `href` satisfy a backlink to `target`? */
export function matchTarget(href: string, target: string): MatchKind {
  const h = urlKey(href);
  const t = urlKey(target);
  if (!h || !t) return "none";
  if (h.host !== t.host) return "none";
  if (h.path === t.path && (t.query === "" || h.query === t.query)) return "exact";
  return "same_domain";
}

/** True when `host` is `domain` or one of its subdomains (both without "www."). */
export function hostBelongsToDomain(host: string, domain: string): boolean {
  const h = hostKey(host);
  const d = hostKey(domain);
  return !!d && (h === d || h.endsWith("." + d));
}
