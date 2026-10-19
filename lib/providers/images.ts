/**
 * Stock image providers (Batch 15). Pure request building and response parsing (no imports), so it is
 * unit-tested with the Node test runner. The network call happens in lib/api-providers.ts through the
 * SSRF-safe client. Third-party images are only ever LINKED and previewed: we never store or host a copy.
 *
 * Adapters: "pexels" (Authorization header) and "pixabay" (key in the query string, per its API).
 */
export const IMAGE_ADAPTERS = ["pexels", "pixabay"] as const;
export type ImageAdapterId = (typeof IMAGE_ADAPTERS)[number];

export function isImageAdapter(value: unknown): value is ImageAdapterId {
  return typeof value === "string" && (IMAGE_ADAPTERS as readonly string[]).includes(value);
}

export const IMAGE_SOURCES: Record<ImageAdapterId, { name: string; home: string; licenseName: string; licenseUrl: string; hosts: string[] }> = {
  pexels: {
    name: "Pexels",
    home: "https://www.pexels.com",
    licenseName: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    hosts: ["pexels.com", "images.pexels.com", "www.pexels.com"],
  },
  pixabay: {
    name: "Pixabay",
    home: "https://pixabay.com",
    licenseName: "Pixabay Content License",
    licenseUrl: "https://pixabay.com/service/license-summary/",
    hosts: ["pixabay.com", "cdn.pixabay.com", "www.pixabay.com"],
  },
};

export interface StockImage {
  id: string;
  /** Small preview (https, on the provider's own host). */
  previewUrl: string;
  /** Provider page for the photo: where it is downloaded and where the licence applies. */
  pageUrl: string;
  /** Provider description or tags: a starting point for alt text, may be empty. */
  alt: string;
  creator: string;
  creatorUrl: string | null;
  source: string;
  licenseName: string;
  licenseUrl: string;
}

export const IMAGE_QUERY_MAX = 80;
export const IMAGE_PER_PAGE = 12;

/** Search words only: letters, digits, spaces and a few separators. Returns null when nothing useful is left. */
export function cleanImageQuery(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v
    .replace(/[^\p{L}\p{N}\s'’&.,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IMAGE_QUERY_MAX);
  return q.length >= 2 ? q : null;
}

export interface BuiltImageRequest {
  url: string;
  headers: Record<string, string>;
}

export function buildImageSearchRequest(input: { adapter: ImageAdapterId; apiKey: string; query: string; baseUrl?: string | null; perPage?: number }): BuiltImageRequest {
  const perPage = Math.max(3, Math.min(30, input.perPage ?? IMAGE_PER_PAGE));
  const q = encodeURIComponent(input.query);
  const trim = (u: string) => u.replace(/\/+$/, "");
  if (input.adapter === "pexels") {
    const base = trim(input.baseUrl?.trim() || "https://api.pexels.com/v1");
    return { url: `${base}/search?query=${q}&per_page=${perPage}&orientation=landscape`, headers: { Authorization: input.apiKey, Accept: "application/json" } };
  }
  const base = trim(input.baseUrl?.trim() || "https://pixabay.com/api");
  return {
    url: `${base}/?key=${encodeURIComponent(input.apiKey)}&q=${q}&image_type=photo&orientation=horizontal&safesearch=true&per_page=${perPage}`,
    headers: { Accept: "application/json" },
  };
}

/** Accepts only https URLs on the provider's own hosts (so a surprising reply cannot point the page elsewhere). */
export function safeProviderUrl(adapter: ImageAdapterId, raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  return IMAGE_SOURCES[adapter].hosts.includes(host) ? u.toString() : null;
}

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseImageResponse(adapter: ImageAdapterId, json: unknown): StockImage[] {
  if (!json || typeof json !== "object") return [];
  const src = IMAGE_SOURCES[adapter];
  const out: StockImage[] = [];
  const base = { source: src.name, licenseName: src.licenseName, licenseUrl: src.licenseUrl };

  if (adapter === "pexels") {
    const photos = (json as { photos?: unknown }).photos;
    if (!Array.isArray(photos)) return [];
    for (const p of photos) {
      if (!p || typeof p !== "object") continue;
      const o = p as { id?: unknown; url?: unknown; alt?: unknown; photographer?: unknown; photographer_url?: unknown; src?: { medium?: unknown; small?: unknown; large?: unknown } };
      const previewUrl = safeProviderUrl(adapter, o.src?.medium) ?? safeProviderUrl(adapter, o.src?.small) ?? safeProviderUrl(adapter, o.src?.large);
      const pageUrl = safeProviderUrl(adapter, o.url);
      const creator = text(o.photographer, 80);
      if (!previewUrl || !pageUrl || !creator || (typeof o.id !== "number" && typeof o.id !== "string")) continue;
      out.push({ id: `pexels-${o.id}`, previewUrl, pageUrl, alt: text(o.alt, 200), creator, creatorUrl: safeProviderUrl(adapter, o.photographer_url), ...base });
    }
    return out;
  }

  const hits = (json as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  for (const h of hits) {
    if (!h || typeof h !== "object") continue;
    const o = h as { id?: unknown; pageURL?: unknown; tags?: unknown; user?: unknown; user_id?: unknown; webformatURL?: unknown; previewURL?: unknown };
    const previewUrl = safeProviderUrl(adapter, o.webformatURL) ?? safeProviderUrl(adapter, o.previewURL);
    const pageUrl = safeProviderUrl(adapter, o.pageURL);
    const creator = text(o.user, 80);
    if (!previewUrl || !pageUrl || !creator || (typeof o.id !== "number" && typeof o.id !== "string")) continue;
    const creatorUrl = typeof o.user_id === "number" && creator ? safeProviderUrl(adapter, `https://pixabay.com/users/${encodeURIComponent(creator)}-${o.user_id}/`) : null;
    out.push({ id: `pixabay-${o.id}`, previewUrl, pageUrl, alt: text(o.tags, 200), creator, creatorUrl, ...base });
  }
  return out;
}

/** The credit line to paste next to a photo. Credit is required by Pexels' terms and kind elsewhere. */
export function creditLine(img: Pick<StockImage, "creator" | "source">): string {
  return `Photo by ${img.creator} on ${img.source}`;
}
