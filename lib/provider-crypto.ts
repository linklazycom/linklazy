import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts API keys that an admin saves in the database (AES-256-GCM).
 * The master secret lives ONLY in the PROVIDER_KEY_ENCRYPTION_SECRET
 * environment variable — never in the database, never sent to the browser.
 *
 * Stored format: "v1:<iv b64>:<authTag b64>:<ciphertext b64>"
 */
const VERSION = "v1";

function keyFrom(secret: string): Buffer {
  if (!secret || secret.trim().length < 16) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET is missing or too short (use at least 16 random characters).");
  }
  return createHash("sha256").update(secret.trim()).digest(); // 32 bytes
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string, secret: string): string {
  const [version, ivB64, tagB64, ctB64] = stored.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) throw new Error("Unsupported secret format.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return pt.toString("utf8");
}

/** "sk-abc123456789wxyz" -> "sk-a…wxyz". Never reveals the middle. */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "••••";
  return `${plain.slice(0, 4)}…${plain.slice(-4)}`;
}
