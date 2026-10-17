/**
 * Decides whether an incoming request belongs to a customer's custom domain (Batch 11).
 * Pure; used by proxy.ts on every request, so it must stay cheap (no DB, no network).
 */
export function normalizeHostHeader(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function isCustomHost(hostHeader: string | null | undefined, ownHosts: readonly string[]): boolean {
  const host = normalizeHostHeader(hostHeader);
  if (!host) return false;
  if (ownHosts.map((h) => h.toLowerCase()).includes(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".vercel.app")) return false; // deployment / preview URLs
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false; // raw IPs, IPv6
  return host.includes(".");
}

/** Everything on a custom host is rewritten to /d/<host>/<path>, so none of the app's other pages are reachable there. */
export function customHostRewritePath(host: string, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/d/${encodeURIComponent(host)}${path === "/" ? "" : path}`;
}
