/**
 * Small SEO helpers (Batch 17). Pure: no imports, unit-tested in tests/seo.test.ts.
 */
export const DEFAULT_SITE_URL = "https://linklazy.com";

/** The public site address without a trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/** A full address for a path like "/browse" (or "" for the home page). */
export function absoluteUrl(path: string, base: string = siteUrl()): string {
  const root = base.replace(/\/+$/, "");
  if (!path || path === "/") return root;
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * JSON for a <script type="application/ld+json"> block. Plain JSON.stringify is NOT safe there: a text containing
 * "</script>" ends the block early and the rest runs as page code. Escaping < > & and the two line-separator characters
 * keeps the JSON identical for search engines but harmless to the HTML parser.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface Crumb {
  name: string;
  path: string;
}

/** schema.org BreadcrumbList for the given trail (first item is usually Home). */
export function breadcrumbSchema(items: Crumb[], base: string = siteUrl()) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path, base) })),
  };
}

/** next `metadata.alternates` for a page: the one address search engines should index. */
export function canonicalFor(path: string) {
  return { canonical: !path || path === "/" ? "/" : path };
}

/** decodeURIComponent that returns null instead of throwing on broken input like "%E0%A4%A". */
export function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** True when a URL path contains a broken % sequence (like "%E0%A4%A") that no page can use. */
export function hasBrokenPercentEncoding(path: string): boolean {
  return safeDecode(path) === null;
}

/** Escapes the wildcard characters of a SQL LIKE / ILIKE pattern so user text only matches itself. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The fixed public pages for the sitemap: path, how often it changes, and importance. */
export const STATIC_SITEMAP: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/browse", changeFrequency: "daily", priority: 0.9 },
  { path: "/blog", changeFrequency: "daily", priority: 0.8 },
  { path: "/niches", changeFrequency: "weekly", priority: 0.7 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.6 },
  { path: "/case-studies", changeFrequency: "weekly", priority: 0.6 },
  { path: "/press-releases", changeFrequency: "monthly", priority: 0.6 },
  { path: "/trust", changeFrequency: "monthly", priority: 0.5 },
  { path: "/referrals", changeFrequency: "monthly", priority: 0.5 },
  { path: "/api-docs", changeFrequency: "monthly", priority: 0.4 },
  { path: "/support", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

/** Shortens text for a picture or title: cut at a word boundary and add "…" only when something was cut. */
export function clampText(value: string, max: number): string {
  const s = value.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const endsOnWord = s[max - 1] === " ";
  const lastSpace = cut.lastIndexOf(" ");
  return `${(!endsOnWord && lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
