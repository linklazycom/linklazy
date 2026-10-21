/**
 * Web-search providers (Batch 16). Pure request building and response parsing (no imports), unit-tested with the Node
 * test runner. The network call happens in lib/api-providers.ts through the SSRF-safe client.
 *
 * Adapters:
 *  - "tavily":     POST https://api.tavily.com/search, key as Bearer token (checked against Tavily's published docs).
 *  - "google_cse": GET  https://www.googleapis.com/customsearch/v1, key + search-engine id (stored in the provider's
 *                  "model" field) in the query string. Written from Google's published format; not run against the live API.
 *  - "searxng":    GET  <your instance>/search?format=json (base URL required, key optional). Not run against a live instance.
 * We only use the providers' official APIs: no result page is ever scraped.
 */
export const SEARCH_ADAPTERS = ["tavily", "google_cse", "searxng"] as const;
export type SearchAdapterId = (typeof SEARCH_ADAPTERS)[number];

export const isSearchAdapter = (v: unknown): v is SearchAdapterId => typeof v === "string" && (SEARCH_ADAPTERS as readonly string[]).includes(v);

export const SEARCH_ADAPTER_INFO: Record<SearchAdapterId, { label: string; needsKey: boolean; needsBaseUrl: boolean; needsEngineId: boolean }> = {
  tavily: { label: "Tavily (API key; free monthly credits reported, check their site)", needsKey: true, needsBaseUrl: false, needsEngineId: false },
  google_cse: { label: "Google Programmable Search (API key + search engine id in the Model field)", needsKey: true, needsBaseUrl: false, needsEngineId: true },
  searxng: { label: "SearXNG (your own server; base URL required, key optional)", needsKey: false, needsBaseUrl: true, needsEngineId: false },
};

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  /** ISO date when the provider gave one, else null (most do not). */
  publishedAt: string | null;
  /** The provider's own relevance number (0 to 1 when given). Informational only. */
  providerScore: number | null;
}

export interface SearchRequestInput {
  adapter: SearchAdapterId;
  baseUrl: string | null;
  apiKey: string | null;
  /** google_cse: the search engine id ("cx"). */
  engineId: string | null;
  query: string;
  maxResults: number;
}

export interface BuiltSearchRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export const SEARCH_QUERY_MAX = 200;
export const SEARCH_RESULTS_MAX = 10;

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export function buildSearchRequest(input: SearchRequestInput): BuiltSearchRequest {
  const q = input.query.replace(/\s+/g, " ").trim().slice(0, SEARCH_QUERY_MAX);
  const max = Math.max(1, Math.min(SEARCH_RESULTS_MAX, Math.floor(input.maxResults) || SEARCH_RESULTS_MAX));

  if (input.adapter === "tavily") {
    if (!input.apiKey) throw new Error("No API key saved");
    const base = trimSlash(input.baseUrl?.trim() || "https://api.tavily.com");
    return {
      method: "POST",
      url: `${base}/search`,
      headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({ query: q, max_results: max, search_depth: "basic", include_answer: false, include_raw_content: false, include_images: false }),
    };
  }

  if (input.adapter === "google_cse") {
    if (!input.apiKey) throw new Error("No API key saved");
    if (!input.engineId) throw new Error("No search engine id set (put it in the Model field)");
    const base = trimSlash(input.baseUrl?.trim() || "https://www.googleapis.com/customsearch/v1");
    const p = new URLSearchParams({ key: input.apiKey, cx: input.engineId, q, num: String(max) });
    return { method: "GET", url: `${base}?${p.toString()}`, headers: { accept: "application/json" } };
  }

  // searxng
  if (!input.baseUrl?.trim()) throw new Error("A base URL is required for SearXNG");
  const base = trimSlash(input.baseUrl.trim());
  const p = new URLSearchParams({ q, format: "json" });
  const headers: Record<string, string> = { accept: "application/json" };
  if (input.apiKey) headers.authorization = `Bearer ${input.apiKey}`;
  return { method: "GET", url: `${base}/search?${p.toString()}`, headers };
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number): string => {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
};
const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const httpUrl = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 2048);
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const score01 = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

/** Turns a provider answer into plain hits. Entries without a usable web address are dropped; an answer with no results is an empty list. */
export function parseSearchResponse(adapter: SearchAdapterId, json: unknown, max = SEARCH_RESULTS_MAX): SearchHit[] {
  const root = rec(json);
  const out: SearchHit[] = [];

  if (adapter === "google_cse") {
    if (root.error) throw new Error("The provider returned an error.");
    const items = Array.isArray(root.items) ? root.items : [];
    for (const it of items) {
      const r = rec(it);
      const url = httpUrl(r.link);
      if (!url) continue;
      out.push({ title: text(r.title, 200), url, snippet: text(r.snippet, 500), publishedAt: null, providerScore: null });
    }
    return out.slice(0, max);
  }

  const list = Array.isArray(root.results) ? root.results : null;
  if (list === null) throw new Error("The provider answer had no results list.");
  for (const it of list) {
    const r = rec(it);
    const url = httpUrl(r.url);
    if (!url) continue;
    out.push({
      title: text(r.title, 200),
      url,
      snippet: text(adapter === "tavily" ? r.content : r.content ?? r.snippet, 500),
      publishedAt: isoOrNull(r.published_date ?? r.publishedDate),
      providerScore: adapter === "tavily" ? score01(r.score) : null,
    });
  }
  return out.slice(0, max);
}
