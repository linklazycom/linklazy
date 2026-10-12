/**
 * Tiny in-memory sliding-window limiter for hot, low-value public endpoints
 * (e.g. /api/track) where a database round-trip per request would cost more
 * than the request is worth.
 *
 * LIMITATION (be honest about it): serverless instances are short-lived and
 * not shared, so this is a best-effort floor against one client hammering one
 * instance — not a global guarantee. Use the database-backed limiter in
 * lib/rate-limit.ts for anything that needs exact limits (signups, scans,
 * money, AI calls).
 */
export interface MemoryRateLimiter {
  /** Returns true if this call is allowed (and counts it), false if over the limit. */
  allow(key: string): boolean;
}

export function createMemoryRateLimiter(opts: {
  max: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): MemoryRateLimiter {
  const now = opts.now ?? (() => Date.now());
  const maxKeys = opts.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  return {
    allow(key: string): boolean {
      const t = now();
      const cutoff = t - opts.windowMs;

      if (hits.size > maxKeys) {
        // Bound memory: drop keys whose newest hit is already outside the window.
        for (const [k, list] of hits) {
          if (list.length === 0 || list[list.length - 1] <= cutoff) hits.delete(k);
        }
        if (hits.size > maxKeys) hits.clear(); // still huge => reset rather than grow
      }

      const list = (hits.get(key) ?? []).filter((x) => x > cutoff);
      if (list.length >= opts.max) {
        hits.set(key, list);
        return false;
      }
      list.push(t);
      hits.set(key, list);
      return true;
    },
  };
}
