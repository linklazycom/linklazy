import { txtRecordName, txtRecordValue } from "@/lib/domains/hostname";

/** DNS checks for custom domains (Batch 11). The resolver is injectable so tests never touch the network. */
export interface DnsResolver {
  resolveTxt(name: string): Promise<string[][]>;
  resolveCname(name: string): Promise<string[]>;
  resolve4(name: string): Promise<string[]>;
}

export async function nodeResolver(): Promise<DnsResolver> {
  const dns = await import("node:dns/promises");
  return { resolveTxt: dns.resolveTxt, resolveCname: dns.resolveCname, resolve4: dns.resolve4 };
}

/** True when any TXT record (joined from its chunks) equals the expected verification value. */
export function txtRecordsMatch(records: string[][], token: string): boolean {
  const want = txtRecordValue(token);
  return records.some((chunks) => chunks.join("").trim() === want);
}

export type TxtCheck = { ok: true } | { ok: false; reason: "not_found" | "mismatch" | "dns_error" };

function isNotFound(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN";
}

export async function checkTxtOwnership(hostname: string, token: string, resolver: DnsResolver): Promise<TxtCheck> {
  try {
    const records = await resolver.resolveTxt(txtRecordName(hostname));
    if (txtRecordsMatch(records, token)) return { ok: true };
    return { ok: false, reason: records.length ? "mismatch" : "not_found" };
  } catch (e) {
    return { ok: false, reason: isNotFound(e) ? "not_found" : "dns_error" };
  }
}

export const VERCEL_A_RECORD = "76.76.21.21";
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

/** Vercel CNAME targets: cname.vercel-dns.com and the newer project-specific vercel-dns-0NN.com names. */
export function isVercelCnameTarget(target: string): boolean {
  return /(^|\.)vercel-dns(-\d+)?\.com\.?$/i.test(target.trim());
}

export type PointingCheck = { pointing: boolean; via: "cname" | "a" | null };

/** Best-effort: does the hostname already point at the hosting platform? (A proxy such as Cloudflare's orange cloud hides this.) */
export async function checkPointsToPlatform(hostname: string, resolver: DnsResolver): Promise<PointingCheck> {
  try {
    const cnames = await resolver.resolveCname(hostname);
    if (cnames.some(isVercelCnameTarget)) return { pointing: true, via: "cname" };
  } catch {
    /* no CNAME: fall through to A records */
  }
  try {
    const ips = await resolver.resolve4(hostname);
    if (ips.includes(VERCEL_A_RECORD)) return { pointing: true, via: "a" };
  } catch {
    /* nothing resolvable */
  }
  return { pointing: false, via: null };
}

export function txtFailureMessage(reason: "not_found" | "mismatch" | "dns_error"): string {
  if (reason === "mismatch") return "A TXT record exists, but its value does not match. Copy the value exactly as shown.";
  if (reason === "dns_error") return "We couldn't reach your DNS right now. Please try again in a minute.";
  return "We couldn't find the TXT record yet. DNS changes can take a few minutes (sometimes longer) to appear.";
}
