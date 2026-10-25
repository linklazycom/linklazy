import { normalizeUrl } from "@/lib/opportunities/rules";

/** Rules for the public growth tools (Batch 18). Pure: no network, no database. */

/** The public tools' limits. Every public tool that costs us something (Ahrefs quota, outbound fetches) has a per-visitor and a whole-site ceiling. */
export const TOOL_LIMITS = {
  dr: { perIpHour: 6, perIpDay: 20, globalDay: 300 },
  recommend: { perIpHour: 3, perIpDay: 10, globalDay: 200 },
  price: { perIpHour: 60 },
} as const;

/** The feature switch for the free tools and the public recommendations (Tools & features page). */
export const PUBLIC_TOOLS_FLAG = "feature_public_tools";
export const PUBLIC_RECOMMEND_FLAG = "feature_public_recommendations";

/** A bare domain from what a visitor typed ("https://www.Example.com/page?x=1" -> "example.com"); null if it is not a public-looking domain. */
export function normalizeDomainInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 253 + 20) return null;
  return normalizeUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`)?.domain ?? null;
}

/** A page address (http/https) from what a visitor typed; adds https:// when missing. */
export function normalizePageInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 2048) return null;
  return normalizeUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`)?.url ?? null;
}

/** An integer Domain Rating 0..100 from a form value; null if invalid. */
export function parseDr(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

export const PRICE_CHECK_MIN_SAMPLES = 5;
export const DR_WINDOW = 5;

/** The DR range compared in the price check: the entered value plus and minus `span`, kept inside 0..100. */
export function drWindow(dr: number, span: number = DR_WINDOW): [number, number] {
  return [Math.max(0, dr - span), Math.min(100, dr + span)];
}

export interface PriceStats {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/** Nearest-rank percentile of an already sorted list. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

/**
 * Real listing prices -> summary numbers. Null when there are fewer than PRICE_CHECK_MIN_SAMPLES prices:
 * a "market price" from two or three listings would be a guess dressed up as data, so we say there is not enough data instead.
 */
export function computePriceStats(prices: number[]): PriceStats | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (clean.length < PRICE_CHECK_MIN_SAMPLES) return null;
  return {
    count: clean.length,
    min: clean[0],
    p25: percentile(clean, 25),
    median: percentile(clean, 50),
    p75: percentile(clean, 75),
    max: clean[clean.length - 1],
  };
}

export interface RecommendSite {
  id: string;
  niche: string;
  dr: number | null;
  da: number | null;
  price_amount: number | null;
  turnaround_hours: number | null;
}

/** The public recommendation list: only fields already shown on /browse, never owner ids or domains. Best DR first, cheaper first on ties. */
export function pickRecommendations(sites: RecommendSite[], limit = 5): RecommendSite[] {
  return [...sites]
    .sort((a, b) => (b.dr ?? -1) - (a.dr ?? -1) || (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity))
    .slice(0, limit)
    .map((s) => ({ id: s.id, niche: s.niche, dr: s.dr, da: s.da, price_amount: s.price_amount, turnaround_hours: s.turnaround_hours }));
}

/** The decision for one public-tool request, given what the rate limiter and the switches said. Pure so the order of checks is tested. */
export type ToolAccess = { ok: true } | { ok: false; status: 429 | 503; error: string };

export function decideToolAccess(input: { enabled: boolean; ipHourOk: boolean; ipDayOk: boolean; globalOk: boolean }): ToolAccess {
  if (!input.enabled) return { ok: false, status: 503, error: "This tool is currently switched off." };
  if (!input.globalOk) return { ok: false, status: 503, error: "This free tool has reached its daily limit for everyone. Please try again tomorrow." };
  if (!input.ipHourOk) return { ok: false, status: 429, error: "You've used this tool a lot in the last hour. Please try again later." };
  if (!input.ipDayOk) return { ok: false, status: 429, error: "You've reached today's limit for this tool. Please try again tomorrow." };
  return { ok: true };
}
