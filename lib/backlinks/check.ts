import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeFetchResponse } from "@/lib/safe-fetch";
import { extractPageInfo, type ParsedLink } from "@/lib/backlinks/html";
import { matchTarget, urlKey } from "@/lib/backlinks/match";

/**
 * The single backlink checker (Batch 13): used by the Backlink Monitor (manual + scheduled)
 * and by the order link-checker cron.
 *
 * Principle: only a page that loaded fine and really lacks the link is "Link not found".
 * Timeouts, DNS errors, 404/5xx, bot-blocking and our own refusals are NEVER reported as "link removed".
 * Everything here reports what the page's HTML contained; it makes no claim about SEO value.
 */
export type BacklinkStatus = "unchecked" | "active" | "not_found" | "unavailable" | "check_failed" | "needs_review";
export type CheckStatus = Exclude<BacklinkStatus, "unchecked">;

export type BacklinkReason =
  | "ok"
  | "anchor_differs"
  | "link_missing"
  | "other_page_on_domain"
  | "mentioned_not_linked"
  | "page_truncated"
  | "page_needs_javascript"
  | "not_html"
  | "http_404"
  | "http_410"
  | "http_4xx"
  | "http_5xx"
  | "http_other"
  | "access_denied"
  | "timeout"
  | "network"
  | "too_many_redirects"
  | "blocked_url"
  | "too_large"
  | "internal";

export const BLOCKING_REL = ["nofollow", "sponsored", "ugc"] as const;

export interface CheckOutcome {
  status: CheckStatus;
  reason: BacklinkReason;
  httpStatus: number | null;
  finalUrl: string | null;
  /** Link-type tokens seen on the chosen link (nofollow / sponsored / ugc), space separated; null = none or no link. */
  rel: string | null;
  /** true = follow, false = nofollow/sponsored/ugc or page-level nofollow, null = no link seen. */
  isFollow: boolean | null;
  foundHref: string | null;
  foundAnchor: string | null;
  /** e.g. "noindex,nofollow" from <meta robots> or X-Robots-Tag; null when none. */
  pageRobots: string | null;
  matchCount: number;
  durationMs: number;
  /** The <a ...> tag as it appeared in the page (plain text). */
  evidence: string | null;
}

export interface CheckInput {
  sourceUrl: string;
  targetUrl: string;
  expectedAnchor?: string | null;
}

type PageEvaluation = Pick<CheckOutcome, "status" | "reason" | "rel" | "isFollow" | "foundHref" | "foundAnchor" | "pageRobots" | "matchCount" | "evidence">;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function robotsFromHeader(value: string | undefined): { noindex: boolean; nofollow: boolean } {
  const tokens = (value ?? "").toLowerCase().split(/[\s,:;]+/);
  return { noindex: tokens.includes("noindex") || tokens.includes("none"), nofollow: tokens.includes("nofollow") || tokens.includes("none") };
}

function mentionsTarget(htmlLower: string, target: string): boolean {
  const k = urlKey(target);
  if (!k) return false;
  return k.path === "" ? htmlLower.includes(`//${k.host}`) || htmlLower.includes(`//www.${k.host}`) : htmlLower.includes(`${k.host}${k.path.toLowerCase()}`);
}

/** Decides what a loaded page says about the backlink. Pure. */
export function evaluatePage(input: {
  html: string;
  pageUrl: string;
  targetUrl: string;
  expectedAnchor?: string | null;
  truncated?: boolean;
  headers?: Record<string, string>;
}): PageEvaluation {
  const info = extractPageInfo(input.html, input.pageUrl);
  const hdr = robotsFromHeader(input.headers?.["x-robots-tag"]);
  const noindex = info.robots.noindex || hdr.noindex;
  const pageNofollow = info.robots.nofollow || hdr.nofollow;
  const pageRobots = [noindex ? "noindex" : "", pageNofollow ? "nofollow" : ""].filter(Boolean).join(",") || null;

  const exact: ParsedLink[] = [];
  const sameDomain: ParsedLink[] = [];
  for (const l of info.links) {
    const m = matchTarget(l.url, input.targetUrl);
    if (m === "exact") exact.push(l);
    else if (m === "same_domain") sameDomain.push(l);
  }

  const wanted = input.expectedAnchor ? norm(input.expectedAnchor) : "";
  if (exact.length > 0) {
    const score = (l: ParsedLink) => (wanted && norm(l.text).includes(wanted) ? 2 : 0) + (l.rel.some((r) => (BLOCKING_REL as readonly string[]).includes(r)) ? 0 : 1);
    let best = exact[0];
    for (const l of exact) if (score(l) > score(best)) best = l;
    const tokens = best.rel.filter((r) => (BLOCKING_REL as readonly string[]).includes(r));
    const anchorOk = !wanted || exact.some((l) => norm(l.text).includes(wanted));
    return {
      status: "active",
      reason: anchorOk ? "ok" : "anchor_differs",
      rel: tokens.length ? tokens.join(" ") : null,
      isFollow: tokens.length === 0 && !pageNofollow,
      foundHref: best.url.slice(0, 2048),
      foundAnchor: best.text || null,
      pageRobots,
      matchCount: exact.length,
      evidence: best.snippet || null,
    };
  }

  const none = { rel: null, isFollow: null, foundHref: null, foundAnchor: null, pageRobots, matchCount: 0, evidence: null };
  if (sameDomain.length > 0) {
    return { ...none, status: "needs_review", reason: "other_page_on_domain", foundHref: sameDomain[0].url.slice(0, 2048), foundAnchor: sameDomain[0].text || null, evidence: sameDomain[0].snippet || null };
  }
  if (mentionsTarget(input.html.toLowerCase(), input.targetUrl)) return { ...none, status: "needs_review", reason: "mentioned_not_linked" };
  if (input.truncated) return { ...none, status: "needs_review", reason: "page_truncated" };
  if (info.anchorCount === 0 && info.hasScripts && input.html.length < 5000) return { ...none, status: "needs_review", reason: "page_needs_javascript" };
  return { ...none, status: "not_found", reason: "link_missing" };
}

/** Non-2xx answers from the source page. Never "link not found". */
export function classifyHttpStatus(status: number): { status: CheckStatus; reason: BacklinkReason } | null {
  if (status >= 200 && status < 300) return null;
  if (status === 404) return { status: "unavailable", reason: "http_404" };
  if (status === 410) return { status: "unavailable", reason: "http_410" };
  if (status === 401 || status === 403 || status === 429) return { status: "unavailable", reason: "access_denied" };
  if (status >= 500) return { status: "unavailable", reason: "http_5xx" };
  if (status >= 400) return { status: "unavailable", reason: "http_4xx" };
  return { status: "check_failed", reason: "http_other" };
}

export function classifyFetchError(err: unknown): { status: CheckStatus; reason: BacklinkReason } {
  if (err instanceof SafeFetchError) {
    switch (err.code) {
      case "blocked":
      case "invalid_url":
        return { status: "check_failed", reason: "blocked_url" };
      case "timeout":
        return { status: "unavailable", reason: "timeout" };
      case "network":
        return { status: "unavailable", reason: "network" };
      case "too_many_redirects":
        return { status: "unavailable", reason: "too_many_redirects" };
      case "too_large":
        return { status: "check_failed", reason: "too_large" };
    }
  }
  return { status: "check_failed", reason: "internal" };
}

const EMPTY: Omit<CheckOutcome, "status" | "reason" | "durationMs"> = {
  httpStatus: null, finalUrl: null, rel: null, isFollow: null, foundHref: null, foundAnchor: null, pageRobots: null, matchCount: 0, evidence: null,
};

export interface CheckDeps {
  fetch?: (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResponse>;
  now?: () => number;
}

/** Fetches the source page (SSRF-safe) and reports what it says about the backlink. Never throws. */
export async function checkBacklink(input: CheckInput, deps: CheckDeps = {}): Promise<CheckOutcome> {
  const doFetch = deps.fetch ?? safeFetch;
  const now = deps.now ?? Date.now;
  const started = now();
  const done = (o: Omit<CheckOutcome, "durationMs">): CheckOutcome => ({ ...o, durationMs: Math.max(0, now() - started) });

  let res: SafeFetchResponse;
  try {
    res = await doFetch(input.sourceUrl, {
      timeoutMs: 12_000,
      maxBytes: 2 * 1024 * 1024,
      truncate: true,
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
    });
  } catch (err) {
    return done({ ...EMPTY, ...classifyFetchError(err) });
  }

  const base = { ...EMPTY, httpStatus: res.status, finalUrl: res.url.slice(0, 2048) };
  const http = classifyHttpStatus(res.status);
  if (http) return done({ ...base, ...http });

  const ct = (res.headers["content-type"] ?? "").toLowerCase();
  if (ct && !/(html|xml|text\/)/.test(ct)) return done({ ...base, status: "needs_review", reason: "not_html" });

  try {
    const ev = evaluatePage({ html: res.text, pageUrl: res.url, targetUrl: input.targetUrl, expectedAnchor: input.expectedAnchor, truncated: res.truncated, headers: res.headers });
    return done({ ...base, ...ev });
  } catch {
    return done({ ...base, status: "check_failed", reason: "internal" });
  }
}

/**
 * What the order link-checker cron does with a result (behaviour of the old check kept:
 * "ok" = the target URL is on the page; "down" = it is not). Everything we could not verify
 * leaves the order untouched instead of being reported as a removed link.
 */
export function orderVerdict(o: Pick<CheckOutcome, "status" | "reason">): "ok" | "down" | "unverified" | "skipped" {
  if (o.status === "active") return "ok";
  if (o.status === "needs_review" && o.reason === "mentioned_not_linked") return "ok";
  if (o.status === "not_found" || (o.status === "needs_review" && o.reason === "other_page_on_domain")) return "down";
  if (o.status === "check_failed" && o.reason === "blocked_url") return "skipped";
  return "unverified";
}
