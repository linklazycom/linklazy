import { hostOfEntry, isBlockedDomain, normalizeUrl, type Confidence, type OppType } from "@/lib/opportunities/rules";
import { scoreHit, type ScoreResult } from "@/lib/opportunities/score";
import type { SearchHit } from "@/lib/providers/search";

/** Turning raw search answers into rows to store (Batch 16). Pure; tested in tests/opportunities-plan.test.ts. */
export interface QueryResult {
  type: OppType;
  query: string;
  provider: string;
  hits: SearchHit[];
}

export interface Candidate {
  type: OppType;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  query: string;
  provider: string;
  score: number;
  confidence: Confidence;
  breakdown: ScoreResult["parts"];
  publishedAt: string | null;
}

/** Domains that must never be offered: the project's own site and its listed competitors. */
export function excludedDomains(projectDomain: string, competitors: string[]): Set<string> {
  const out = new Set<string>([projectDomain.toLowerCase().replace(/^www\./, "")]);
  for (const c of competitors) {
    const h = hostOfEntry(c);
    if (h) out.add(h);
  }
  return out;
}

const keyOf = (type: string, domain: string) => `${domain}|${type}`;

/**
 * Normalises, filters, scores and de-duplicates. One candidate per website and kind (the best-scoring page wins);
 * the order of the result is best score first.
 */
export function collectCandidates(results: QueryResult[], ctx: { terms: string[]; exclude: Set<string>; now?: Date }): { candidates: Candidate[]; seen: number; dropped: number } {
  const best = new Map<string, Candidate>();
  let seen = 0;
  let dropped = 0;
  for (const r of results) {
    for (const hit of r.hits) {
      seen++;
      const n = normalizeUrl(hit.url);
      if (!n || isBlockedDomain(n.domain) || ctx.exclude.has(n.domain)) {
        dropped++;
        continue;
      }
      const s = scoreHit({ type: r.type, hit: { ...hit, url: n.url }, terms: ctx.terms, now: ctx.now });
      const cand: Candidate = {
        type: r.type,
        url: n.url,
        domain: n.domain,
        title: hit.title.slice(0, 300),
        snippet: hit.snippet.slice(0, 600),
        query: r.query.slice(0, 300),
        provider: r.provider.slice(0, 120),
        score: s.score,
        confidence: s.confidence,
        breakdown: s.parts,
        publishedAt: hit.publishedAt,
      };
      const k = keyOf(cand.type, cand.domain);
      const prev = best.get(k);
      if (!prev || cand.score > prev.score) best.set(k, cand);
    }
  }
  const candidates = [...best.values()].sort((a, b) => b.score - a.score || (a.domain < b.domain ? -1 : 1));
  return { candidates, seen, dropped };
}

export interface ExistingOpp {
  id: string;
  domain: string;
  type: string;
  score: number;
}

export interface WritePlan {
  inserts: Candidate[];
  updates: { id: string; cand: Candidate }[];
  /** Already stored with an equal or better score. */
  unchanged: number;
  /** Would be new, but the project is full. */
  skippedForCapacity: number;
}

/** Decides what to write: new rows (up to the room left in the project), better-scoring replacements for stored ones, nothing else. */
export function planWrites(cands: Candidate[], existing: ExistingOpp[], capacityLeft: number): WritePlan {
  const have = new Map(existing.map((e) => [keyOf(e.type, e.domain), e]));
  const plan: WritePlan = { inserts: [], updates: [], unchanged: 0, skippedForCapacity: 0 };
  let room = Math.max(0, capacityLeft);
  for (const c of cands) {
    const e = have.get(keyOf(c.type, c.domain));
    if (e) {
      if (c.score > e.score) plan.updates.push({ id: e.id, cand: c });
      else plan.unchanged++;
    } else if (room > 0) {
      plan.inserts.push(c);
      room--;
    } else {
      plan.skippedForCapacity++;
    }
  }
  return plan;
}
