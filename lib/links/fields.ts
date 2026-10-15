/** Pure field cleaners for short-link metadata (Batch 9). Tested in tests/link-fields.test.ts. */
const CONTROL = /[\u0000-\u001f\u007f]/g;

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

export const TITLE_MAX = 120;
export const FOLDER_MAX = 40;
export const TAG_MAX = 30;
export const TAGS_MAX_COUNT = 10;

export function cleanTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,;|]/) : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, TAG_MAX);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= TAGS_MAX_COUNT) break;
  }
  return out;
}

/** Parses an ISO / datetime-local string. Returns ISO string, null (empty), or "invalid". */
export function parseExpiry(v: unknown, now: Date = new Date()): string | null | "invalid" | "past" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return "invalid";
  if (t <= now.getTime()) return "past";
  if (t > now.getTime() + 10 * 365 * 24 * 3600 * 1000) return "invalid";
  return new Date(t).toISOString();
}

/** Strips characters PostgREST treats as filter syntax so a search box can't break `.or()` filters. */
export function safeSearchTerm(v: string | undefined | null): string {
  return (v ?? "").replace(/[,()*%\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
