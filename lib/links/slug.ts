/**
 * Pure slug rules for short links (Batch 9). No imports: unit-tested with the
 * plain Node test runner (tests/link-slug.test.ts).
 *
 * Slugs are stored lowercase so "Promo" and "promo" can never be two links.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Slugs nobody may claim (they would confuse users or clash with future routes). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin", "administrator", "api", "app", "assets", "about", "bio", "blog", "browse",
  "contact", "dashboard", "docs", "help", "home", "l", "link", "links", "login",
  "logout", "linklazy", "me", "null", "undefined", "official", "payment", "payments",
  "pricing", "privacy", "profile", "register", "report", "report-link", "root",
  "security", "settings", "signin", "signout", "signup", "static", "status", "support",
  "terms", "test", "trust", "verify", "wallet", "www",
]);

export type SlugError = "too_short" | "too_long" | "bad_chars" | "bad_edges" | "reserved";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/;

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Cheap shape check used by the redirect route before touching the database. */
export function isPlausibleSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_RE.test(slug);
}

export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; error: SlugError; message: string } {
  const slug = normalizeSlug(raw);
  if (slug.length < SLUG_MIN) return { ok: false, error: "too_short", message: `Slug must be at least ${SLUG_MIN} characters.` };
  if (slug.length > SLUG_MAX) return { ok: false, error: "too_long", message: `Slug must be at most ${SLUG_MAX} characters.` };
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    return { ok: false, error: "bad_chars", message: "Use only letters, numbers, hyphens and underscores." };
  }
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "bad_edges", message: "A slug must start and end with a letter or number." };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "reserved", message: "That slug is reserved. Please choose another." };
  return { ok: true, slug };
}

// No 0/o/1/l/i: random slugs stay readable when typed or read aloud.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Random slug. `randomBytes` is injectable for tests; defaults to Web Crypto. */
export function generateSlug(length = 7, randomBytes?: (n: number) => Uint8Array): string {
  const bytes = randomBytes ? randomBytes(length * 2) : globalThis.crypto.getRandomValues(new Uint8Array(length * 2));
  let out = "";
  // Rejection sampling keeps the distribution uniform (no modulo bias).
  const limit = 256 - (256 % ALPHABET.length);
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    if (bytes[i] < limit) out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  if (out.length < length) return generateSlug(length, randomBytes); // astronomically rare
  return out;
}

/**
 * Accepts a pasted short URL ("https://linklazy.com/l/Promo?x=1", "linklazy.com/l/promo")
 * or a bare slug and returns the normalized slug, or null.
 */
export function extractSlug(input: string): string | null {
  const text = (input ?? "").trim();
  if (!text) return null;
  const m = /\/l\/([^/?#\s]+)/i.exec(text);
  const candidate = normalizeSlug(m ? m[1] : text);
  return isPlausibleSlug(candidate) ? candidate : null;
}
