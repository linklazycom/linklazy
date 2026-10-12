/**
 * Pure sanitiser for the public /api/track beacon (audit R7). The endpoint is
 * unauthenticated by design (anonymous visitors), so every field is
 * length-capped and typed before it is written to page_views.
 */
export interface TrackPayload {
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export const TRACK_LIMITS = { path: 512, referrer: 1024, utm: 100, body: 4096 } as const;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // Strip control characters, trim, cap length.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

/** Returns a safe payload, or null when the input isn't a usable object. */
export function sanitizeTrackPayload(input: unknown): TrackPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const b = input as Record<string, unknown>;
  const path = clip(b.path, TRACK_LIMITS.path) ?? "/";
  if (!path.startsWith("/")) return null; // a path always starts with "/"
  return {
    path,
    referrer: clip(b.referrer, TRACK_LIMITS.referrer),
    utm_source: clip(b.utm_source, TRACK_LIMITS.utm),
    utm_medium: clip(b.utm_medium, TRACK_LIMITS.utm),
    utm_campaign: clip(b.utm_campaign, TRACK_LIMITS.utm),
  };
}
