/**
 * Pure URL / IP safety rules for server-side fetching (audit R2/R3).
 * No imports on purpose: this file is unit-tested with the plain Node test
 * runner (see tests/safe-url.test.ts) and is used by lib/safe-fetch.ts.
 *
 * Threat model: a user (buyer, seller, link owner, or an admin-entered API
 * base URL) supplies a URL and our SERVER fetches it. We must never let that
 * reach localhost, private networks, link-local/cloud-metadata addresses, or
 * non-web ports/protocols — including through redirects and DNS tricks.
 */

export type SafeUrlReason =
  | "invalid_url"
  | "bad_protocol"
  | "has_credentials"
  | "bad_port"
  | "blocked_host"
  | "blocked_ip";

export class UrlNotAllowedError extends Error {
  reason: SafeUrlReason;
  constructor(reason: SafeUrlReason, message: string) {
    super(message);
    this.name = "UrlNotAllowedError";
    this.reason = reason;
  }
}

/** Ports a user-supplied URL may use. Anything else (SSH, DB, admin ports...) is refused. */
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Hostname suffixes that are internal by convention. */
const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".private"];

function ipv4ToParts(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map((p) => Number(p));
  if (parts.some((n) => n < 0 || n > 255)) return null;
  return parts;
}

function isBlockedIpv4(parts: number[]): boolean {
  const [a, b, c] = parts;
  if (a === 0) return true; // "this" network, incl. 0.0.0.0
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Expands an IPv6 literal (no brackets/zone) into 8 numeric groups, or null if malformed. */
function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);

  // Embedded IPv4 tail, e.g. ::ffff:192.168.0.1
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToParts(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    s = s.slice(0, lastColon + 1) + hi + ":" + lo;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some((n) => Number.isNaN(n)) ? null : nums;
}

function isBlockedIpv6(g: number[]): boolean {
  const allZeroButLast = g.slice(0, 7).every((n) => n === 0);
  if (allZeroButLast && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation range
  if (g[0] === 0x2002) return true; // 6to4: embeds an IPv4 address we can't trust
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true; // NAT64: embeds an IPv4 address
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) -> judge the embedded v4
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) {
    const parts = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff];
    return isBlockedIpv4(parts);
  }
  return false;
}

/** True when the IP literal (v4 or v6) must NOT be contacted. Unparseable => blocked. */
export function isBlockedIp(ip: string): boolean {
  const raw = ip.trim().replace(/^\[|\]$/g, "");
  const v4 = ipv4ToParts(raw);
  if (v4) return isBlockedIpv4(v4);
  if (raw.includes(":")) {
    const v6 = expandIpv6(raw);
    return v6 ? isBlockedIpv6(v6) : true;
  }
  return true;
}

/** True when the hostname is itself an IP literal (v4 dotted or bracketless v6). */
export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return ipv4ToParts(h) !== null || h.includes(":");
}

/**
 * Validates a URL string BEFORE any network access and returns the parsed URL.
 * Throws UrlNotAllowedError when it must not be fetched. This is only the
 * syntactic/static layer: lib/safe-fetch.ts additionally checks the resolved
 * IP addresses at connect time (DNS rebinding) and on every redirect hop.
 *
 * Note: the WHATWG URL parser already normalises tricky IPv4 spellings
 * (decimal 2130706433, hex 0x7f000001, octal 0177.0.0.1 all become 127.0.0.1),
 * so isBlockedIp() sees the canonical form.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlNotAllowedError("invalid_url", "That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlNotAllowedError("bad_protocol", "Only http(s) URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new UrlNotAllowedError("has_credentials", "URLs with embedded credentials are not allowed.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UrlNotAllowedError("bad_port", "Only the standard web ports (80/443) are allowed.");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new UrlNotAllowedError("invalid_url", "That doesn't look like a valid URL.");

  const isSingleLabel = !host.includes(".") && !host.includes(":"); // e.g. "intranet", "db"
  if (host === "localhost" || host === "metadata" || host === "metadata.google.internal" || isSingleLabel) {
    throw new UrlNotAllowedError("blocked_host", "This URL points to a private or internal address.");
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UrlNotAllowedError("blocked_host", "This URL points to a private or internal address.");
  }
  if (isIpLiteral(host) && isBlockedIp(host)) {
    throw new UrlNotAllowedError("blocked_ip", "This URL points to a private or internal address.");
  }

  return url;
}
