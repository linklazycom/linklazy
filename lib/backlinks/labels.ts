import type { BacklinkReason, BacklinkStatus } from "@/lib/backlinks/check";

/** Plain-English labels for the Backlink Monitor UI (Batch 13). */
export const STATUS_LABEL: Record<BacklinkStatus, string> = {
  unchecked: "Not checked yet",
  active: "Active",
  not_found: "Link not found",
  unavailable: "Source unavailable",
  check_failed: "Check failed",
  needs_review: "Needs review",
};

export const STATUS_STYLE: Record<BacklinkStatus, string> = {
  unchecked: "bg-line/60 text-muted",
  active: "bg-signal-soft text-signal",
  not_found: "bg-red-50 text-red-700",
  unavailable: "bg-amber-soft text-amber",
  check_failed: "bg-amber-soft text-amber",
  needs_review: "bg-brand-soft text-brand-violet",
};

export const STATUS_ORDER: BacklinkStatus[] = ["active", "needs_review", "not_found", "unavailable", "check_failed", "unchecked"];

export const REASON_TEXT: Record<BacklinkReason, string> = {
  ok: "The page links to your target.",
  anchor_differs: "The link is there, but none of its anchor texts contain the anchor you expected.",
  link_missing: "The page loaded fine but has no link to your target page.",
  other_page_on_domain: "The page links to your website, but not to this exact target page.",
  mentioned_not_linked: "Your target address appears on the page, but not as a clickable link.",
  page_truncated: "The page is very large and we only read the first part, so we can't be sure the link is missing.",
  page_needs_javascript: "The page seems to build its content in the browser, so we can't see its links.",
  not_html: "The address is not a normal web page (for example a PDF or an image).",
  http_404: "The source page was not found (404). It may have been moved or deleted.",
  http_410: "The source page is gone (410).",
  http_4xx: "The source page answered with an error.",
  http_5xx: "The source site had a server error. This is often temporary.",
  http_other: "The source page answered in an unexpected way.",
  access_denied: "The source site refused our checker (401/403/429), so we couldn't verify the link.",
  timeout: "The source page took too long to answer.",
  network: "We couldn't reach the source site (network or DNS problem).",
  too_many_redirects: "The source page redirected too many times.",
  blocked_url: "We can't check this address for safety reasons (it is not a public web address).",
  too_large: "The source page is too large to check.",
  internal: "Something went wrong on our side while checking.",
};

export function reasonText(reason: string | null | undefined): string {
  return reason && reason in REASON_TEXT ? REASON_TEXT[reason as BacklinkReason] : "";
}

/** Small chips for how the link is marked up, from the last check. */
export function linkTypeChips(rel: string | null, isFollow: boolean | null, pageRobots: string | null): { label: string; tone: "good" | "warn" | "info" }[] {
  const chips: { label: string; tone: "good" | "warn" | "info" }[] = [];
  const tokens = (rel ?? "").split(/\s+/).filter(Boolean);
  if (isFollow === true) chips.push({ label: "Follow", tone: "good" });
  for (const t of tokens) chips.push({ label: t === "ugc" ? "UGC" : t[0].toUpperCase() + t.slice(1), tone: "warn" });
  if (isFollow === false && tokens.length === 0) chips.push({ label: "Page-level nofollow", tone: "warn" });
  if (pageRobots?.includes("noindex")) chips.push({ label: "Page is noindex", tone: "info" });
  return chips;
}
