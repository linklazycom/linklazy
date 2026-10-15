import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Link passwords (Batch 9). scrypt with a per-password salt; stored as
 * "s1:<salt b64>:<hash b64>". This protects casual access to a link, it is not
 * an account credential — the min length is deliberately modest.
 */
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 100;

export function hashLinkPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32);
  return ["s1", salt.toString("base64"), hash.toString("base64")].join(":");
}

export function verifyLinkPassword(plain: string, stored: string): boolean {
  try {
    const [v, saltB64, hashB64] = stored.split(":");
    if (v !== "s1" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(plain, Buffer.from(saltB64, "base64"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
