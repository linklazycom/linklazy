import { NICHE_KEYWORDS } from "@/lib/niche-keywords";

export interface ScanResult {
  detectedNiche: string | null;
  confidence: number; // 0-100
  matchedKeywords: string[];
  pageText: string; // raw extracted signal text, reused by the AI fallback classifier
}

/**
 * Fetches a buyer's homepage and pulls out title, meta description, and
 * heading text — the same lightweight signal set search engines weight
 * most heavily — then scores each niche by keyword hit count.
 *
 * Deliberately simple/free (no AI call): good enough to get a buyer a
 * reasonable starting shortlist, and the buyer can always override the
 * detected niche or manually add/remove sites from the result list.
 */
export async function scanBuyerSite(url: string): Promise<ScanResult> {
  const html = await fetchHtml(url);
  const text = extractSignalText(html);

  if (!text) {
    return { detectedNiche: null, confidence: 0, matchedKeywords: [], pageText: "" };
  }

  const lowerText = text.toLowerCase();
  let bestNiche: string | null = null;
  let bestScore = 0;
  let bestMatches: string[] = [];
  let totalHitsAcrossNiches = 0;

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const matched: string[] = [];
    for (const kw of keywords) {
      if (lowerText.includes(kw)) matched.push(kw);
    }
    totalHitsAcrossNiches += matched.length;
    if (matched.length > bestScore) {
      bestScore = matched.length;
      bestNiche = niche;
      bestMatches = matched;
    }
  }

  if (!bestNiche || bestScore === 0) {
    return { detectedNiche: null, confidence: 0, matchedKeywords: [], pageText: text };
  }

  // Confidence = this niche's share of all keyword hits found, so a page
  // that hits many keywords in one niche and almost none elsewhere scores
  // near 100; a page with scattered, ambiguous hits scores lower.
  const confidence = Math.round((bestScore / totalHitsAcrossNiches) * 100);

  return { detectedNiche: bestNiche, confidence, matchedKeywords: bestMatches, pageText: text };
}

// SECURITY: this URL is buyer-supplied and this function runs server-side,
// so without a check it's an SSRF vector — a buyer could point the scanner
// at localhost, a private/internal IP, or the cloud metadata endpoint
// (169.254.169.254) instead of a real public site.
function assertPublicHttpUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "169.254.169.254" || // cloud metadata
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new Error("This URL points to a private or internal address and can't be scanned.");
  }
}

async function fetchHtml(url: string): Promise<string> {
  assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkLazyScanner/1.0; +https://linklazy.com)",
      },
    });
    if (!res.ok) throw new Error(`Site responded with status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Pulls <title>, meta description, H1-H3 text, and a slice of body
 *  paragraph text out of raw HTML.
 *
 *  Title/meta/headings alone under-detect niches whose defining words
 *  show up mainly in body copy (e.g. a site about crows might only say
 *  "crow" inside article paragraphs, not in its H1). Pulling in the
 *  first chunk of <p> text closes that gap while staying cheap and
 *  keyword-matchable — no HTML parser dependency needed.
 */
function extractSignalText(html: string): string {
  const parts: string[] = [];

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) parts.push(stripTags(title[1]));

  const metaDesc = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  );
  if (metaDesc) parts.push(metaDesc[1]);

  const metaKeywords = html.match(
    /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i
  );
  if (metaKeywords) parts.push(metaKeywords[1]);

  const headings = html.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi) ?? [];
  for (const h of headings.slice(0, 30)) {
    parts.push(stripTags(h));
  }

  // Body paragraphs: this is where niche-defining words most often live
  // (e.g. "crow" repeated through article copy, not necessarily in the
  // title). Cap it so one giant page doesn't blow past a reasonable
  // fetch/parse budget.
  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  let bodyChars = 0;
  const BODY_CHAR_BUDGET = 6000;
  for (const p of paragraphs) {
    if (bodyChars >= BODY_CHAR_BUDGET) break;
    const clean = stripTags(p);
    if (!clean) continue;
    parts.push(clean);
    bodyChars += clean.length;
  }

  return parts.join(" ").trim();
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
