/** Pure redirect-eligibility rules (Batch 9). Tested in tests/link-rules.test.ts. */
export interface RedirectState {
  is_active: boolean;
  disabled_reason: string | null;
  expires_at: string | null;
  max_clicks: number | null;
  click_count: number;
  has_password: boolean;
}

export type BlockReason = "taken_down" | "inactive" | "expired" | "limit_reached";

export type RedirectDecision =
  | { action: "redirect" }
  | { action: "ask_password" }
  | { action: "block"; reason: BlockReason };

export function evaluateRedirect(link: RedirectState, now: Date = new Date()): RedirectDecision {
  if (link.disabled_reason) return { action: "block", reason: "taken_down" };
  if (!link.is_active) return { action: "block", reason: "inactive" };
  if (link.expires_at) {
    const t = Date.parse(link.expires_at);
    if (Number.isFinite(t) && t <= now.getTime()) return { action: "block", reason: "expired" };
  }
  if (link.max_clicks !== null && link.click_count >= link.max_clicks) {
    return { action: "block", reason: "limit_reached" };
  }
  if (link.has_password) return { action: "ask_password" };
  return { action: "redirect" };
}

/** Status label shown in the dashboard/admin lists. */
export function linkStatus(link: Omit<RedirectState, "has_password">, now: Date = new Date()): "active" | "inactive" | "expired" | "limit_reached" | "taken_down" {
  const d = evaluateRedirect({ ...link, has_password: false }, now);
  return d.action === "block" ? d.reason : "active";
}
