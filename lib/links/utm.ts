/** UTM helpers (Batch 9). Pure; tested in tests/link-utm.test.ts. */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

export const UTM_PRESETS: { label: string; params: UtmParams }[] = [
  { label: "Newsletter", params: { utm_source: "newsletter", utm_medium: "email" } },
  { label: "Facebook post", params: { utm_source: "facebook", utm_medium: "social" } },
  { label: "X / Twitter", params: { utm_source: "twitter", utm_medium: "social" } },
  { label: "LinkedIn post", params: { utm_source: "linkedin", utm_medium: "social" } },
  { label: "YouTube description", params: { utm_source: "youtube", utm_medium: "video" } },
  { label: "Google Ads", params: { utm_source: "google", utm_medium: "cpc" } },
  { label: "QR code", params: { utm_source: "qr", utm_medium: "offline" } },
];

const MAX_VALUE = 100;

export function cleanUtmValue(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_VALUE);
}

/**
 * Adds/overwrites UTM params on a URL, keeping every other query param and
 * the #hash. Empty values remove that UTM key. Returns null if `url` is not
 * parseable as an absolute URL.
 */
export function applyUtm(url: string, params: UtmParams): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  for (const key of UTM_KEYS) {
    if (!(key in params)) continue;
    const value = cleanUtmValue(params[key]);
    if (value) u.searchParams.set(key, value);
    else u.searchParams.delete(key);
  }
  return u.toString();
}

export function readUtm(url: string): UtmParams {
  const out: UtmParams = {};
  try {
    const u = new URL(url);
    for (const key of UTM_KEYS) {
      const v = u.searchParams.get(key);
      if (v) out[key] = v;
    }
  } catch {
    /* not a URL */
  }
  return out;
}
