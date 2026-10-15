/** Pure helpers for the admin blocklist (Batch 9). Tested in tests/link-blocklist.test.ts. */
export const REPORT_REASONS = ["phishing", "malware", "spam", "illegal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** "https://www.Evil.com:8080/path?x" -> "evil.com"; null when the input isn't a domain. */
export function normalizeBlockDomain(raw: string): string | null {
  let v = (raw ?? "").trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  v = v.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v) && v.length <= 253 ? v : null;
}
