interface MatchCandidate {
  da: number | null;
  niche: string;
}

/**
 * Scores how good an exchange match is between two sites, 0-100.
 * Closer DA and matching niche score higher. This is intentionally
 * simple and transparent — sellers can see why a match was suggested.
 */
export function computeMatchScore(a: MatchCandidate, b: MatchCandidate): number {
  let score = 100;

  if (a.da != null && b.da != null) {
    score -= Math.min(Math.abs(a.da - b.da) * 2, 60);
  } else {
    score -= 20; // missing metrics on one side — less confidence
  }

  const sameNiche = a.niche.trim().toLowerCase() === b.niche.trim().toLowerCase();
  if (!sameNiche) score -= 25;

  return Math.max(0, Math.round(score));
}
