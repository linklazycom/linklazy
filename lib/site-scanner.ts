import { NICHE_KEYWORDS } from "@/lib/niche-keywords";

export interface ScanResult {
  detectedNiche: string | null;
  confidence: number; // 0-100
  matchedKeywords: string[];
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
    return { detectedNiche: null, confidence: 0, matchedKeywords: [] };
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
    return { detectedNiche: null, confidence: 0, matchedKeywords: [] };
  }

  // Confidence = this niche's share of all keyword hits found, so a page
  // that hits many keywords in one niche and almost none elsewhere scores
  // near 100; a page with scattered, ambiguous hits scores lower.
  const confidence = Math.round((bestScore / totalHitsAcrossNiches) * 100);

  return { detectedNiche: bestNiche, confidence, matchedKeywords: bestMatches };
}

async function fetchHtml(url: string): Promise<string> {
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

/** Pulls <title>, meta description, and H1/H2 text out of raw HTML. */
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

  const headings = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi) ?? [];
  for (const h of headings.slice(0, 20)) {
    parts.push(stripTags(h));
  }

  return parts.join(" ").trim();
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
