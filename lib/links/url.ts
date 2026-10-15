import { assertPublicHttpUrl, UrlNotAllowedError } from "@/lib/safe-url";

/**
 * Destination-URL rules for short links (Batch 9, spec §2খ "অপব্যবহার-প্রতিরোধ").
 * Pure (no network, no DB): unit-tested in tests/link-url.test.ts.
 */
export const MAX_URL_LENGTH = 2048;

/** Public URL shorteners: chaining through them hides the real destination. */
export const KNOWN_SHORTENER_HOSTS: readonly string[] = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
  "rebrand.ly", "shorturl.at", "t.ly", "rb.gy", "lnkd.in", "tiny.cc", "v.gd", "s.id",
];

export type DestinationError =
  | "empty" | "too_long" | "invalid" | "bad_protocol" | "private_host" | "loop"
  | "shortener" | "blocked_domain";

export interface DestinationOptions {
  /** Hostnames that belong to LinkLazy itself, e.g. ["linklazy.com", "www.linklazy.com"]. */
  ownHosts?: readonly string[];
  /** Admin-managed blocked domains (lowercase). */
  blockedDomains?: readonly string[];
}

export type DestinationResult =
  | { ok: true; url: string; host: string }
  | { ok: false; error: DestinationError; message: string };

/** True when `host` equals a listed domain or is a subdomain of it. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  const d = domain.toLowerCase().replace(/^\.+/, "").replace(/\.$/, "");
  return !!d && (h === d || h.endsWith("." + d));
}

export function validateDestinationUrl(raw: string, opts: DestinationOptions = {}): DestinationResult {
  let input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "empty", message: "Enter a destination URL." };
  if (input.length > MAX_URL_LENGTH) {
    return { ok: false, error: "too_long", message: `URL is too long (max ${MAX_URL_LENGTH} characters).` };
  }
  // Control characters / whitespace inside a URL are never legitimate.
  if (/[\u0000-\u0020\u007f]/.test(input)) {
    return { ok: false, error: "invalid", message: "That doesn't look like a valid URL." };
  }
  // Friendly: "example.com/page" -> https://example.com/page. Anything that
  // already has a scheme (javascript:, data:, ftp: ...) is judged as written.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = "https://" + input.replace(/^\/\//, "");

  let url: URL;
  try {
    url = assertPublicHttpUrl(input);
  } catch (e) {
    if (e instanceof UrlNotAllowedError) {
      switch (e.reason) {
        case "bad_protocol":
          return { ok: false, error: "bad_protocol", message: "Only http:// and https:// links are allowed." };
        case "blocked_host":
        case "blocked_ip":
        case "bad_port":
        case "has_credentials":
          return { ok: false, error: "private_host", message: e.message };
        default:
          return { ok: false, error: "invalid", message: "That doesn't look like a valid URL." };
      }
    }
    return { ok: false, error: "invalid", message: "That doesn't look like a valid URL." };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  const own = (opts.ownHosts ?? []).map((h) => h.toLowerCase());
  if (own.includes(host) && /^\/l(\/|$)/i.test(url.pathname)) {
    return { ok: false, error: "loop", message: "A short link cannot point to another LinkLazy short link." };
  }
  if (KNOWN_SHORTENER_HOSTS.some((d) => hostMatchesDomain(host, d))) {
    return { ok: false, error: "shortener", message: "Links to other URL shorteners are not allowed. Use the final destination instead." };
  }
  if ((opts.blockedDomains ?? []).some((d) => hostMatchesDomain(host, d))) {
    return { ok: false, error: "blocked_domain", message: "This domain is not allowed on LinkLazy." };
  }

  return { ok: true, url: url.toString(), host };
}

/**
 * Defence in depth at redirect time: whatever is stored, we only ever send
 * browsers to plain http(s) URLs.
 */
export function isSafeRedirectTarget(stored: string): boolean {
  try {
    const u = new URL(stored);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
