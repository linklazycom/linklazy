import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links (Batch 16B-1). A link carries <contact id>.<signature>; the signature is an HMAC of the
 * id and the email under a server secret, so links cannot be guessed or forged and no token table is needed.
 * Changing the secret invalidates links already sent, so it is derived once and left alone.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAC_RE = /^[0-9a-f]{32}$/;

/** OUTREACH_UNSUBSCRIBE_SECRET if set (>= 16 chars), else derived from the provider-key secret, else null (links disabled). */
export function getUnsubscribeSecret(env: Record<string, string | undefined> = process.env): string | null {
  const direct = env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (direct && direct.length >= 16) return direct;
  const base = env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (base && base.length >= 16) return createHmac("sha256", base).update("outreach-unsubscribe-v1").digest("hex");
  return null;
}

const mac = (secret: string, id: string, email: string) => createHmac("sha256", secret).update(`unsub:${id}:${email.toLowerCase()}`).digest("hex").slice(0, 32);

export function signUnsubscribeToken(secret: string, contactId: string, email: string): string {
  return `${contactId}.${mac(secret, contactId, email)}`;
}

export function parseUnsubscribeToken(token: unknown): { id: string; mac: string } | null {
  if (typeof token !== "string" || token.length > 100) return null;
  const [id, m, extra] = token.split(".");
  if (extra !== undefined || !id || !m || !UUID_RE.test(id) || !MAC_RE.test(m)) return null;
  return { id: id.toLowerCase(), mac: m.toLowerCase() };
}

export function verifyUnsubscribeToken(secret: string, parsed: { id: string; mac: string }, email: string): boolean {
  const expected = Buffer.from(mac(secret, parsed.id, email));
  const given = Buffer.from(parsed.mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
