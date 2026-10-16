import { classifyBrowser, classifyDevice, type BrowserClass, type DeviceClass } from "@/lib/analytics/ua";
import { hashVisitor, utcDay } from "@/lib/analytics/visitor";

/** Builds the privacy-safe record for one click (Batch 10). Pure apart from the hashing. */
export interface ClickRecord {
  source: "direct" | "qr";
  country: string | null;
  device: DeviceClass;
  browser: BrowserClass;
  referrer_host: string | null;
  visitor_hash: string | null;
}

/** "https://www.Example.com/a?b" -> "example.com"; null for missing/invalid or our own hosts. */
export function referrerHost(referer: string | null | undefined, ownHosts: readonly string[] = []): string | null {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host || host.length > 100) return null;
    const own = ownHosts.map((h) => h.toLowerCase().replace(/^www\./, ""));
    return own.includes(host) ? null : host;
  } catch {
    return null;
  }
}

export function sourceFromUrl(url: string): "direct" | "qr" {
  try {
    return new URL(url).searchParams.get("src") === "qr" ? "qr" : "direct";
  } catch {
    return "direct";
  }
}

export function buildClickRecord(input: {
  url: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  secret: string | null;
  ownHosts?: readonly string[];
  now?: Date;
}): ClickRecord {
  const country = input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null;
  const hasIp = !!input.ip && input.ip !== "unknown";
  return {
    source: sourceFromUrl(input.url),
    country,
    device: classifyDevice(input.userAgent),
    browser: classifyBrowser(input.userAgent),
    referrer_host: referrerHost(input.referer, input.ownHosts),
    // No secret or no IP => no visitor id (uniques unavailable, no 10-second dedupe) rather than a weak one.
    visitor_hash: input.secret && hasIp ? hashVisitor(input.secret, utcDay(input.now), input.ip as string, input.userAgent ?? "") : null,
  };
}
