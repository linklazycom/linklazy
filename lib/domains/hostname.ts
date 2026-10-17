/**
 * Pure hostname rules for custom domains (Batch 11). No imports, so it is unit-tested
 * with the plain Node runner (tests/domain-hostname.test.ts).
 */
export const HOSTNAME_MAX = 253;

/** Suffixes that can never be claimed (platform domains, local/reserved names). */
const FORBIDDEN_SUFFIXES = [
  "vercel.app", "vercel.com", "vercel.sh", "now.sh", "localhost", "local", "internal", "intranet", "lan",
  "home", "corp", "test", "example", "invalid", "onion", "arpa",
] as const;

export type HostnameError =
  | "empty" | "too_long" | "has_scheme_or_path" | "bad_format" | "ip_address"
  | "single_label" | "forbidden" | "own_domain" | "blocked";

export type HostnameResult =
  | { ok: true; hostname: string }
  | { ok: false; error: HostnameError; message: string };

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function isIpLike(h: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  if (h.includes(":")) return true;
  // All-numeric TLD (e.g. "1.2.3.4.5" or "0x7f.1") can be parsed as an address by some resolvers.
  const tld = h.split(".").pop() ?? "";
  return /^[0-9x]+$/i.test(tld);
}

function matchesDomain(host: string, domain: string): boolean {
  const d = domain.toLowerCase().replace(/^\.+/, "").replace(/\.$/, "");
  return !!d && (host === d || host.endsWith("." + d));
}

export function validateHostname(
  raw: string,
  opts: { ownHosts?: readonly string[]; blockedDomains?: readonly string[] } = {}
): HostnameResult {
  const input = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!input) return { ok: false, error: "empty", message: "Enter a domain, for example go.yourbrand.com." };
  if (input.length > HOSTNAME_MAX) return { ok: false, error: "too_long", message: "That domain name is too long." };
  if (/[/?#@\s:]/.test(input)) {
    return { ok: false, error: "has_scheme_or_path", message: "Enter only the domain name, without https://, a path or a port." };
  }
  if (isIpLike(input)) return { ok: false, error: "ip_address", message: "IP addresses are not allowed. Use a domain name." };
  const labels = input.split(".");
  if (labels.length < 2) return { ok: false, error: "single_label", message: "Enter a full domain such as go.yourbrand.com." };
  if (!labels.every((l) => LABEL_RE.test(l))) {
    return { ok: false, error: "bad_format", message: "Use only letters, numbers and hyphens in each part of the domain." };
  }
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld) && !/^xn--[a-z0-9-]{2,59}$/.test(tld)) {
    return { ok: false, error: "bad_format", message: "That domain ending doesn't look valid." };
  }
  if (FORBIDDEN_SUFFIXES.some((s) => matchesDomain(input, s))) {
    return { ok: false, error: "forbidden", message: "That domain cannot be used." };
  }
  if ((opts.ownHosts ?? []).some((h) => matchesDomain(input, h.replace(/^www\./, "")))) {
    return { ok: false, error: "own_domain", message: "You cannot use a LinkLazy domain here." };
  }
  if ((opts.blockedDomains ?? []).some((d) => matchesDomain(input, d))) {
    return { ok: false, error: "blocked", message: "This domain is not allowed on LinkLazy." };
  }
  return { ok: true, hostname: input };
}

const TWO_PART_SLDS = ["co", "com", "org", "net", "gov", "edu", "ac"];

/** How many trailing labels form "the domain" the customer owns (heuristic, no public-suffix list): brand.com = 2, brand.co.uk = 3. */
function registrableLabelCount(hostname: string): number {
  const labels = hostname.split(".");
  return labels.length >= 3 && labels[labels.length - 1].length === 2 && TWO_PART_SLDS.includes(labels[labels.length - 2]) ? 3 : 2;
}

/** True for "yourbrand.com" (needs an A record); false for "go.yourbrand.com" (a CNAME works). */
export function isApexLike(hostname: string): boolean {
  return hostname.split(".").length <= registrableLabelCount(hostname);
}

export const TXT_HOST_PREFIX = "_linklazy-verify";
export const TXT_VALUE_PREFIX = "linklazy-verification=";

export function txtRecordName(hostname: string): string {
  return `${TXT_HOST_PREFIX}.${hostname}`;
}
export function txtRecordValue(token: string): string {
  return `${TXT_VALUE_PREFIX}${token}`;
}

/**
 * Many DNS panels append the customer's domain automatically, so they want only the part
 * BEFORE it ("_linklazy-verify.go" instead of "_linklazy-verify.go.brand.com"). Heuristic
 * (no public-suffix list): the last 2 labels, or 3 for names like brand.co.uk, are "the domain".
 */
export function relativeDnsName(fullName: string, hostname: string): string {
  const domain = hostname.split(".").slice(-registrableLabelCount(hostname)).join(".");
  if (fullName === domain) return "@";
  return fullName.endsWith("." + domain) ? fullName.slice(0, -(domain.length + 1)) : fullName;
}
