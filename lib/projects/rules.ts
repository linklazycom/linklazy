import { validateDestinationUrl } from "@/lib/links/url";
import { NICHES } from "@/lib/niches";
import {
  KEYWORD_MAX,
  KEYWORD_MIN,
  MAX_COMPETITORS,
  PROJECT_DESC_MAX,
  PROJECT_NAME_MAX,
  PROJECT_NOTES_MAX,
} from "@/lib/projects/options";

/**
 * Pure validation / cleaning for buyer projects (Batch 12).
 * No network, no database: unit-tested in tests/project-rules.test.ts.
 */
type Fail = { ok: false; message: string; field: string };

const CONTROL_KEEP_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f]/g;
const CONTROL_ALL = /[\u0000-\u001f\u007f]/g;

/** Single-line text: control chars removed, whitespace collapsed, trimmed, capped. Empty -> null. */
export function cleanLine(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(CONTROL_ALL, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

/** Plain multi-line text (never HTML): keeps line breaks, max `maxLines` lines. Empty -> null. */
export function cleanMultiline(v: unknown, max: number, maxLines = 20): string | null {
  if (typeof v !== "string") return null;
  const lines = v
    .replace(/\r/g, "")
    .replace(CONTROL_KEEP_NEWLINE, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .slice(0, maxLines);
  const t = lines.join("\n").trim().slice(0, max);
  return t || null;
}

export function validateProjectName(v: unknown): { ok: true; value: string } | Fail {
  const t = cleanLine(v, PROJECT_NAME_MAX);
  return t ? { ok: true, value: t } : { ok: false, message: "Enter a project name.", field: "name" };
}

export function cleanDescription(v: unknown): string | null {
  return cleanMultiline(v, PROJECT_DESC_MAX, 10);
}

export function cleanNotes(v: unknown): string | null {
  return cleanMultiline(v, PROJECT_NOTES_MAX, 40);
}

/** Host without a leading "www.". */
export function domainOf(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export interface NormalizedProjectUrl {
  canonicalUrl: string;
  domain: string;
}

/**
 * "Example.com/Blog/?utm=1#top" -> { canonicalUrl: "https://example.com/Blog", domain: "example.com" }.
 * Query string and fragment are dropped, a trailing slash is dropped (except the bare root, kept as "/"),
 * default ports disappear. Private/internal hosts, URL shorteners and credentials are rejected by the
 * shared destination validator. The domain (without "www.") is what makes a project unique per user.
 */
export function normalizeProjectUrl(raw: unknown, ownHosts: readonly string[] = []): { ok: true; value: NormalizedProjectUrl } | Fail {
  const r = validateDestinationUrl(typeof raw === "string" ? raw : "", { ownHosts });
  if (!r.ok) return { ok: false, message: r.message, field: "url" };
  const u = new URL(r.url);
  if (ownHosts.map((h) => h.toLowerCase()).includes(u.hostname.toLowerCase())) {
    return { ok: false, message: "Enter your own website, not a LinkLazy address.", field: "url" };
  }
  u.hash = "";
  u.search = "";
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const canonicalUrl = `${u.protocol}//${u.host}${path}`;
  if (canonicalUrl.length > 2048) return { ok: false, message: "That URL is too long.", field: "url" };
  return { ok: true, value: { canonicalUrl, domain: domainOf(u.hostname) } };
}

/** Splits a textarea / pasted blob or an array into trimmed non-empty items. */
function toItems(input: unknown, separators: RegExp): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(separators) : [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * Keywords: one per line or comma/semicolon separated. Whitespace collapsed, bullets/#/quotes stripped,
 * duplicates removed ignoring case (first spelling wins). Too long / too short / too many is an error,
 * so nothing is silently lost.
 */
export function cleanKeywords(input: unknown, maxCount: number): { ok: true; keywords: string[] } | Fail {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of toItems(input, /[\n\r,;]+/)) {
    const k = item
      .replace(CONTROL_ALL, " ")
      .replace(/^[\s\-•*#"'“‘]+|[\s"'”’]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!k) continue;
    if (k.length < KEYWORD_MIN) return { ok: false, message: `"${k}" is too short (at least ${KEYWORD_MIN} characters).`, field: "keywords" };
    if (k.length > KEYWORD_MAX) return { ok: false, message: `"${k.slice(0, 30)}…" is too long (at most ${KEYWORD_MAX} characters).`, field: "keywords" };
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  if (out.length > maxCount) return { ok: false, message: `You can save up to ${maxCount} keywords per project (you entered ${out.length}).`, field: "keywords" };
  return { ok: true, keywords: out };
}

/**
 * Competitors: websites or bare domains, one per line or comma separated. Stored as plain domains
 * (no scheme, no "www."), deduplicated, never the project's own domain, at most MAX_COMPETITORS.
 */
export function cleanCompetitors(
  input: unknown,
  opts: { ownDomain?: string | null; ownHosts?: readonly string[] } = {}
): { ok: true; domains: string[] } | Fail {
  const out: string[] = [];
  for (const item of toItems(input, /[\n\r,;\s]+/)) {
    const t = item.trim();
    if (!t) continue;
    const r = validateDestinationUrl(t, { ownHosts: opts.ownHosts });
    if (!r.ok) return { ok: false, message: `"${t.slice(0, 40)}" is not a valid website: ${r.message}`, field: "competitors" };
    const d = domainOf(new URL(r.url).hostname);
    if (opts.ownDomain && d === opts.ownDomain) continue;
    if (opts.ownHosts?.map((h) => h.toLowerCase()).includes(d)) {
      return { ok: false, message: "Competitors must be other websites, not LinkLazy.", field: "competitors" };
    }
    if (!out.includes(d)) out.push(d);
  }
  if (out.length > MAX_COMPETITORS) return { ok: false, message: `You can list up to ${MAX_COMPETITORS} competitors.`, field: "competitors" };
  return { ok: true, domains: out };
}

/** Empty -> null. Otherwise a niche from the site's own niche list (any casing), or an error. */
export function validateNiche(v: unknown): { ok: true; value: string | null } | Fail {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, message: "Choose a niche from the list.", field: "niche" };
  const hit = NICHES.find((n) => n.toLowerCase() === v.trim().toLowerCase());
  return hit ? { ok: true, value: hit } : { ok: false, message: "Choose a niche from the list.", field: "niche" };
}

/** Empty -> null. "us" -> "US". */
export function validateCountry(v: unknown): { ok: true; value: string | null } | Fail {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  if (typeof v !== "string" || !/^[A-Za-z]{2}$/.test(v.trim())) return { ok: false, message: "Use a two-letter country code such as US.", field: "country" };
  return { ok: true, value: v.trim().toUpperCase() };
}

/** Empty -> null. "PT-br" -> "pt-BR". */
export function validateLanguage(v: unknown): { ok: true; value: string | null } | Fail {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  const m = typeof v === "string" ? /^([A-Za-z]{2,3})(?:-([A-Za-z]{2}))?$/.exec(v.trim()) : null;
  if (!m) return { ok: false, message: "Use a language code such as en or pt-BR.", field: "language" };
  return { ok: true, value: m[2] ? `${m[1].toLowerCase()}-${m[2].toUpperCase()}` : m[1].toLowerCase() };
}

/** Case-insensitive diff between the saved keywords and the wanted list. */
export function diffKeywords(
  existing: readonly { id: string; keyword: string }[],
  wanted: readonly string[]
): { toInsert: string[]; toDeleteIds: string[] } {
  const wantedKeys = new Set(wanted.map((k) => k.toLowerCase()));
  const existingKeys = new Set(existing.map((e) => e.keyword.toLowerCase()));
  return {
    toInsert: wanted.filter((k) => !existingKeys.has(k.toLowerCase())),
    toDeleteIds: existing.filter((e) => !wantedKeys.has(e.keyword.toLowerCase())).map((e) => e.id),
  };
}
