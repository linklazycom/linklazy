import { createHmac } from "node:crypto";

/**
 * Privacy-preserving visitor id (Batch 10). We never store an IP address.
 * visitor = HMAC(daily key, ip + "|" + user agent), where the daily key is
 * derived from a server secret and the UTC date. Because the key changes
 * every day, the same person gets a different id tomorrow: "unique visitors"
 * is per day, and ids cannot be linked across days or reversed to an IP.
 */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function hashVisitor(secret: string, day: string, ip: string, userAgent: string): string {
  const dailyKey = createHmac("sha256", secret).update(`link-visitor:${day}`).digest();
  return createHmac("sha256", dailyKey).update(`${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/** LINK_HASH_SECRET if set (>= 16 chars), else derived from the provider-key secret, else null (uniques disabled). */
export function getHashSecret(env: Record<string, string | undefined> = process.env): string | null {
  const direct = env.LINK_HASH_SECRET;
  if (direct && direct.length >= 16) return direct;
  const base = env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (base && base.length >= 16) return createHmac("sha256", base).update("link-hash-secret-v1").digest("hex");
  return null;
}
