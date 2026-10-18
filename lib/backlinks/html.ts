/**
 * Minimal, dependency-free HTML link extractor for the Backlink Monitor (Batch 13).
 * Pure (no network): unit-tested in tests/backlink-html.test.ts.
 *
 * The page being checked is attacker-controlled content, so everything here is bounded:
 * a single linear pass over the markup, capped tag length, capped anchor count, capped text.
 * Nothing extracted is ever treated as HTML again: it is stored and shown as plain text.
 */
export const MAX_ANCHORS = 20_000;
const MAX_TAG_LEN = 4000;
const MAX_INNER_LEN = 2000;
export const ANCHOR_TEXT_MAX = 200;
export const EVIDENCE_MAX = 500;

export interface ParsedLink {
  /** Absolute http(s) URL after resolving against <base> / the page URL. */
  url: string;
  rel: string[];
  text: string;
  /** The opening <a ...> tag plus the visible text, as plain text (for evidence). */
  snippet: string;
}

export interface PageInfo {
  links: ParsedLink[];
  /** From <meta name="robots|googlebot">. */
  robots: { noindex: boolean; nofollow: boolean };
  /** True when the page ships scripts: used to spot pages that build their links in the browser. */
  hasScripts: boolean;
  anchorCount: number;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
    if (g[0] === "#") {
      const code = g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[g.toLowerCase()] ?? m;
  });
}

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  // skip "<a" / "<meta" and the closing ">"
  const body = tag.replace(/^<[a-z0-9]+/i, "").replace(/\/?>$/, "");
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(body))) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function collapse(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function visibleText(inner: string): string {
  const withImages = inner.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = parseAttributes(tag).alt;
    return alt ? ` [image: ${alt}] ` : " [image] ";
  });
  return collapse(decodeEntities(withImages.replace(/<[^>]*>/g, " "))).slice(0, ANCHOR_TEXT_MAX);
}

/** Finds the end ('>' index) of a tag starting at `start`, honouring quoted attribute values. */
function findTagEnd(html: string, start: number): number {
  let quote = "";
  const limit = Math.min(html.length, start + MAX_TAG_LEN);
  for (let i = start; i < limit; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i;
    }
  }
  return -1;
}

function resolveHttpUrl(href: string, base: string): string | null {
  const t = href.trim();
  if (!t || t.startsWith("#")) return null;
  if (/^(javascript|mailto|tel|data|sms|whatsapp):/i.test(t)) return null;
  try {
    const u = new URL(t, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function extractPageInfo(rawHtml: string, pageUrl: string): PageInfo {
  const hasScripts = /<script\b/i.test(rawHtml);
  // Remove things that are not page content (their text may contain fake links).
  const html = rawHtml
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, " ");

  // Page-level robots + <base href>
  const robots = { noindex: false, nofollow: false };
  let base = pageUrl;
  const metaRe = /<meta\b[^>]*>/gi;
  let mm: RegExpExecArray | null;
  let metaCount = 0;
  while ((mm = metaRe.exec(html)) && metaCount++ < 200) {
    const a = parseAttributes(mm[0]);
    const name = (a.name ?? "").toLowerCase();
    if (name === "robots" || name === "googlebot") {
      const tokens = (a.content ?? "").toLowerCase().split(/[\s,]+/);
      if (tokens.includes("noindex") || tokens.includes("none")) robots.noindex = true;
      if (tokens.includes("nofollow") || tokens.includes("none")) robots.nofollow = true;
    }
  }
  const baseMatch = /<base\b[^>]*>/i.exec(html);
  if (baseMatch) {
    const href = parseAttributes(baseMatch[0]).href;
    const resolved = href ? resolveHttpUrl(href, pageUrl) : null;
    if (resolved) base = resolved;
  }

  // Closing-tag positions, collected once so the anchor loop stays linear.
  const closers: number[] = [];
  const closeRe = /<\/a\s*>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = closeRe.exec(html))) closers.push(cm.index);

  const links: ParsedLink[] = [];
  const openRe = /<a\b/gi;
  let om: RegExpExecArray | null;
  let anchorCount = 0;
  let ci = 0;
  while ((om = openRe.exec(html)) && anchorCount < MAX_ANCHORS) {
    anchorCount++;
    const start = om.index;
    const end = findTagEnd(html, start);
    if (end === -1) continue;
    const tag = html.slice(start, end + 1);
    while (ci < closers.length && closers[ci] < end) ci++;
    // Inner content: up to the next closing tag, but never past the next opening tag or a sane length.
    let innerEnd = ci < closers.length ? closers[ci] : html.length;
    innerEnd = Math.min(innerEnd, end + 1 + MAX_INNER_LEN);
    const nextOpen = html.slice(end + 1, innerEnd).search(/<a\b/i);
    if (nextOpen !== -1) innerEnd = end + 1 + nextOpen;
    const inner = html.slice(end + 1, innerEnd);

    const attrs = parseAttributes(tag);
    if (!attrs.href) continue;
    const url = resolveHttpUrl(attrs.href, base);
    if (!url) continue;
    const text = visibleText(inner);
    const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    links.push({ url, rel, text, snippet: collapse(`${tag.slice(0, 300)} ${text}`).slice(0, EVIDENCE_MAX) });
  }

  return { links, robots, hasScripts, anchorCount };
}
