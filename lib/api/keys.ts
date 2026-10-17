import { createHash, randomBytes } from "node:crypto";

/**
 * API key format and rules (Batch 11). Pure apart from randomness: unit-tested in tests/api-keys.test.ts.
 * A key looks like  ll_live_<43 url-safe chars>  (256 bits). Only its SHA-256 hash is stored;
 * a fast hash is fine here because the key is long and random (nothing to brute-force).
 */
export const KEY_PREFIX = "ll_live_";
export const API_SCOPES = ["links:read", "links:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_LABELS: Record<ApiScope, string> = {
  "links:read": "Read links and click statistics",
  "links:write": "Create, edit and delete links",
};

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Cheap shape check before touching the database. */
export function looksLikeApiKey(v: string): boolean {
  return v.startsWith(KEY_PREFIX) && v.length === KEY_PREFIX.length + 43 && /^[A-Za-z0-9_-]+$/.test(v.slice(KEY_PREFIX.length));
}

/** Pulls the key out of "Authorization: Bearer <key>"; null when missing/malformed. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/** Keeps only known scopes, de-duplicated; null when nothing valid is left. */
export function cleanScopes(input: unknown): ApiScope[] | null {
  if (!Array.isArray(input)) return null;
  const out = Array.from(new Set(input.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(String(s)))));
  return out.length ? out : null;
}

export function hasScope(scopes: readonly string[], needed: ApiScope): boolean {
  return scopes.includes(needed);
}

export interface KeyState {
  revoked_at: string | null;
  expires_at: string | null;
}

export function keyIsUsable(k: KeyState, now: Date = new Date()): boolean {
  if (k.revoked_at) return false;
  if (k.expires_at) {
    const t = Date.parse(k.expires_at);
    if (Number.isFinite(t) && t <= now.getTime()) return false;
  }
  return true;
}

export function cleanKeyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  return v.length ? v : null;
}
