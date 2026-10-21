import type { Confidence, OppType } from "@/lib/opportunities/rules";
import type { SearchHit } from "@/lib/providers/search";

/**
 * Transparent 0-100 score for an opportunity (Batch 16). Five parts with fixed maximums:
 * relevance 35, evidence of a real submission route 25, quality signals 20, clarity 10, freshness 10.
 * It uses ONLY what the search result itself shows (title, address, snippet, date). It never invents Domain Authority,
 * traffic or spam scores. Every part comes with a plain-words reason so the user can see why.
 */
export const SCORE_MAX = { relevance: 35, submission: 25, quality: 20, clarity: 10, freshness: 10 } as const;
export type ScorePart = keyof typeof SCORE_MAX;

export interface ScoreLine {
  points: number;
  max: number;
  note: string;
}
export interface ScoreResult {
  score: number;
  confidence: Confidence;
  parts: Record<ScorePart, ScoreLine>;
}

const STRONG: Record<OppType, string[]> = {
  guest_post: ["write for us", "guest post", "guest posting", "guest author", "submit a guest", "submit guest", "contributor guidelines", "become a contributor", "become an author", "contribute to"],
  directory: ["submit your site", "submit your website", "submit site", "submit a site", "add your site", "add your website", "add your business", "submit a listing", "submit listing", "add a listing", "submit url", "list your"],
  profile: ["create a profile", "create an account", "create your profile", "member profile", "sign up", "register", "join the community", "join our community"],
  resource_page: ["useful resources", "helpful resources", "recommended resources", "helpful links", "useful links", "resource list", "resources for", "best resources"],
  comment: ["leave a comment", "leave a reply", "post a comment", "add a comment", "comments are open"],
};
const WEAK: Record<OppType, string[]> = {
  guest_post: ["guest", "contribute", "contributor", "submit", "guidelines"],
  directory: ["directory", "listing", "submit", "listings"],
  profile: ["forum", "community", "members", "profile"],
  resource_page: ["resources", "links", "resource"],
  comment: ["comment", "comments", "reply"],
};
const URL_HINT: Record<OppType, RegExp> = {
  guest_post: /(write-?for-?us|guest|contribut|submit|author)/i,
  directory: /(directory|submit|listing|add-?(site|url|business)|business)/i,
  profile: /(register|signup|sign-up|join|member|profile|community|forum)/i,
  resource_page: /(resource|links|useful|helpful|recommended)/i,
  comment: /(blog|post|article|news|\d{4}\/\d{2})/i,
};
const HOW_TO = /(guidelines|submit|contact|email us|apply|submission|form|pitch)/i;
const LOW_QUALITY_HOSTS = [".blogspot.", ".wordpress.com", ".wixsite.com", ".weebly.com", ".tumblr.com", ".webnode.", ".jimdosite.com", ".000webhostapp.com", ".sites.google.com"];
const SPAM_WORDS = /\b(casino|porn|xxx|viagra|payday loan|adult dating|escort|replica watches|buy followers|cheap pills)\b/i;

const lc = (s: string) => s.toLowerCase();
const has = (hay: string, list: string[]) => list.some((p) => hay.includes(p));

export interface ScoreInput {
  type: OppType;
  hit: SearchHit;
  /** From projectTerms(). */
  terms: string[];
  now?: Date;
}

export function scoreHit({ type, hit, terms, now = new Date() }: ScoreInput): ScoreResult {
  const title = lc(hit.title);
  const snippet = lc(hit.snippet);
  let path = "";
  let host = "";
  let isHttps = false;
  let depth = 0;
  try {
    const u = new URL(hit.url);
    path = lc(decodeURIComponent(u.pathname));
    host = lc(u.hostname);
    isHttps = u.protocol === "https:";
    depth = u.pathname.split("/").filter(Boolean).length;
  } catch {
    // unusable address: every part below stays low
  }
  const urlText = `${host}${path}`;

  // 1. Relevance (35): how many of the project's own words appear, title counting more than snippet or address.
  let relevance: ScoreLine;
  if (terms.length === 0) {
    relevance = { points: 0, max: SCORE_MAX.relevance, note: "The project has no niche or keywords to compare with. Add some for a relevance score." };
  } else {
    let inTitle = 0;
    let elsewhere = 0;
    for (const t of terms) {
      if (title.includes(t)) inTitle++;
      else if (snippet.includes(t) || urlText.includes(t)) elsewhere++;
    }
    const denom = Math.min(terms.length, 4);
    const raw = Math.min(1, (inTitle + elsewhere * 0.6) / denom);
    const points = Math.round(SCORE_MAX.relevance * raw);
    relevance = { points, max: SCORE_MAX.relevance, note: `${inTitle} of your words in the title, ${elsewhere} more in the description or address.` };
  }

  // 2. Evidence of a submission route (25)
  const head = `${title} ${urlText}`;
  let submission: ScoreLine;
  let confidence: Confidence;
  if (has(head, STRONG[type])) {
    submission = { points: 25, max: SCORE_MAX.submission, note: "The title or address uses a typical submission phrase." };
    confidence = "likely";
  } else if (has(snippet, STRONG[type])) {
    submission = { points: 18, max: SCORE_MAX.submission, note: "The description mentions a typical submission phrase." };
    confidence = "likely";
  } else if (has(`${head} ${snippet}`, WEAK[type])) {
    submission = { points: 8, max: SCORE_MAX.submission, note: "Related words appear, but nothing says they accept submissions. Check the page." };
    confidence = "possible";
  } else {
    submission = { points: 0, max: SCORE_MAX.submission, note: "No sign of a submission route in the search result. The type is only a guess from the search phrase." };
    confidence = "unknown";
  }

  // 3. Quality signals (20): simple, checkable facts only.
  const spam = SPAM_WORDS.test(`${title} ${snippet} ${urlText}`);
  const freeHost = LOW_QUALITY_HOSTS.some((h) => host.includes(h));
  const q = {
    https: isHttps ? 5 : 0,
    snippet: hit.snippet.length >= 100 ? 4 : hit.snippet.length >= 40 ? 2 : 0,
    title: hit.title.length >= 15 && hit.title.length <= 120 ? 2 : 0,
    host: freeHost ? 0 : 5,
    clean: spam ? 0 : 4,
  };
  const qNotes = [isHttps ? "secure address (https)" : "no https", freeHost ? "free-hosting subdomain" : "own domain", spam ? "spam-like words found" : "no spam-like words", q.snippet > 0 ? "has a description" : "little or no description"];
  const quality: ScoreLine = { points: q.https + q.snippet + q.title + q.host + q.clean, max: SCORE_MAX.quality, note: qNotes.join("; ") + ". No traffic or authority data is used." };

  // 4. Clarity (10): is it a page made for this purpose?
  const hint = URL_HINT[type].test(path);
  const c = { hint: hint ? 5 : 0, shallow: depth <= 3 ? 3 : 0, howTo: HOW_TO.test(snippet) || HOW_TO.test(title) ? 2 : 0 };
  const clarity: ScoreLine = {
    points: c.hint + c.shallow + c.howTo,
    max: SCORE_MAX.clarity,
    note: `${hint ? "address names the purpose" : "address does not name the purpose"}; ${depth <= 3 ? "short path" : "deep path"}; ${c.howTo ? "mentions how to apply or contact" : "no how-to wording"}.`,
  };

  // 5. Freshness (10): only when the provider gave a date.
  let freshness: ScoreLine;
  const published = hit.publishedAt ? new Date(hit.publishedAt) : null;
  if (published && !Number.isNaN(published.getTime())) {
    const days = (now.getTime() - published.getTime()) / 86_400_000;
    if (days < 0 || days <= 365) freshness = { points: 10, max: SCORE_MAX.freshness, note: "Published within the last year." };
    else if (days <= 730) freshness = { points: 6, max: SCORE_MAX.freshness, note: "Published 1 to 2 years ago." };
    else freshness = { points: 2, max: SCORE_MAX.freshness, note: "Published more than 2 years ago." };
  } else {
    freshness = { points: 4, max: SCORE_MAX.freshness, note: "Publish date unknown (the search provider did not give one)." };
  }

  const parts = { relevance, submission, quality, clarity, freshness };
  const score = Math.max(0, Math.min(100, Object.values(parts).reduce((s, p) => s + p.points, 0)));
  return { score, confidence, parts };
}
