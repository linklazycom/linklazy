/**
 * Ahrefs' public Domain Rating endpoint. Free to use, but — despite some
 * blog posts claiming otherwise — it DOES require a free Ahrefs APIv3 key
 * sent as `Authorization: Bearer <token>`. Without it Ahrefs returns
 * 401/403. Get a key at https://app.ahrefs.com/account/api-keys (free
 * Ahrefs account, no card needed) and set it as AHREFS_API_KEY.
 *
 * Docs: https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
 */

const AHREFS_DR_ENDPOINT = "https://api.ahrefs.com/v3/public/domain-rating-free";

export interface DrResult {
  ok: boolean;
  domainRating: number | null;
  error?: string;
}

function extractHostname(input: string): string {
  try {
    const url = input.includes("://") ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

/**
 * Fetch DR for a single domain. Never throws — always returns a result
 * object so callers (cron jobs, submit handlers) can continue past failures
 * without aborting a whole batch.
 */
export async function fetchDomainRating(domainOrUrl: string): Promise<DrResult> {
  const target = extractHostname(domainOrUrl);
  const apiKey = process.env.AHREFS_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      domainRating: null,
      error: "AHREFS_API_KEY is not set — get a free key at app.ahrefs.com/account/api-keys",
    };
  }

  try {
    const res = await fetch(
      `${AHREFS_DR_ENDPOINT}?target=${encodeURIComponent(target)}&output=json`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      const status = res.status;
      const hint =
        status === 401 || status === 403
          ? " — check that AHREFS_API_KEY is valid"
          : status === 429
            ? " — rate limited, will retry on next scheduled check"
            : "";
      return { ok: false, domainRating: null, error: `HTTP ${status}${hint}` };
    }

    const data = await res.json();
    const dr = data?.domain_rating?.domain_rating;

    if (typeof dr !== "number") {
      return { ok: false, domainRating: null, error: "Unexpected response shape" };
    }

    return { ok: true, domainRating: Math.round(dr) };
  } catch (err) {
    return {
      ok: false,
      domainRating: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Fetch DR for many domains with a small delay between requests. Used by
 * the weekly refresh cron so we stay well inside Ahrefs' free-endpoint
 * rate limit instead of hammering it with Promise.all.
 */
export async function fetchDomainRatingBatch(
  domains: string[],
  delayMs = 500
): Promise<Map<string, DrResult>> {
  const results = new Map<string, DrResult>();

  for (const domain of domains) {
    results.set(domain, await fetchDomainRating(domain));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/** DR band used for badge coloring and copy across the UI. */
export function drBand(dr: number): "new" | "growing" | "established" | "strong" | "elite" {
  if (dr <= 10) return "new";
  if (dr <= 30) return "growing";
  if (dr <= 50) return "established";
  if (dr <= 70) return "strong";
  return "elite";
}
