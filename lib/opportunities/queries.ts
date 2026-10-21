import { MAX_QUERIES_PER_RUN, type OppType } from "@/lib/opportunities/rules";
import { SEARCH_QUERY_MAX } from "@/lib/providers/search";

/**
 * Search phrases for each kind of opportunity. A phrase is only a way to LOOK for pages: finding a page with it proves
 * nothing, which is why every result is labelled "likely / possible / not confirmed" (see score.ts).
 */
const TEMPLATES: Record<OppType, string[]> = {
  guest_post: ['"{s}" "write for us"', '{s} "guest post guidelines"', '{s} "submit a guest post"'],
  directory: ['{s} directory "submit your site"', '{s} "add your website" directory', '{s} "submit a listing" directory'],
  profile: ['{s} forum "create an account" profile', '{s} community "join" "member profile"', '{s} "register" "your profile" community'],
  resource_page: ['{s} "useful resources" links', '{s} "helpful links" resources', '{s} "recommended resources"'],
  comment: ['{s} blog "leave a comment"', '{s} "leave a reply" blog', '{s} blog "post a comment"'],
};

export interface ProjectTerms {
  niche: string | null;
  keywords: string[];
}

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "our", "how", "what", "best", "top", "new", "free", "online", "about"]);

/** Words that describe the project: used to judge relevance. Lower case, letters and digits, no filler words. */
export function projectTerms(p: ProjectTerms): string[] {
  const words = [p.niche ?? "", ...p.keywords]
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words)].slice(0, 12);
}

/** A phrase safe to put inside a search query: no quotes or operators. */
export function cleanSubject(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/["“”'‘’()[\]{}:<>|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export interface PlannedQuery {
  type: OppType;
  query: string;
}

/**
 * Up to `max` queries, taking turns between the chosen types so each gets a fair share. Round 1 uses the first phrase of
 * every type with the main subject (first keyword, else the niche); round 2 the second phrase with the niche (else the second keyword)...
 * Returns [] when the project has no niche and no keywords.
 */
export function buildQueries(types: OppType[], p: ProjectTerms, max = MAX_QUERIES_PER_RUN): PlannedQuery[] {
  const keywords = p.keywords.map(cleanSubject).filter(Boolean);
  const niche = cleanSubject(p.niche);
  const primary = keywords[0] || niche;
  if (!primary) return [];
  const secondary = niche && niche.toLowerCase() !== primary.toLowerCase() ? niche : keywords[1] || primary;

  const out: PlannedQuery[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 3 && out.length < max; round++) {
    for (const type of types) {
      if (out.length >= max) break;
      const tpl = TEMPLATES[type][round];
      if (!tpl) continue;
      const query = tpl.replace("{s}", round % 2 === 0 ? primary : secondary).slice(0, SEARCH_QUERY_MAX);
      const key = query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type, query });
    }
  }
  return out;
}
