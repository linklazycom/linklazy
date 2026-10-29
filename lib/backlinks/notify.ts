import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/** What to tell the owner after a scheduled check. Pure so it can be tested (tests/backlink-notify.test.ts). */
export type BacklinkNotice = "lost" | "restored" | null;

/**
 * "lost":     the page loaded fine and the link was missing TWICE in a row (one miss can be a CMS hiccup),
 *             and the owner was not already told about this episode.
 * "restored": the link is back after the owner was told it was lost.
 * Temporary problems (unavailable / check_failed) never trigger anything.
 */
export function decideBacklinkNotice(input: { prevStatus: string; newStatus: string; lostNotifiedAt: string | null }): BacklinkNotice {
  if (input.newStatus === "not_found" && input.prevStatus === "not_found" && !input.lostNotifiedAt) return "lost";
  if (input.newStatus === "active" && input.lostNotifiedAt) return "restored";
  return null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildBacklinkEmail(kind: "lost" | "restored", input: { sourceUrl: string; targetUrl: string; siteUrl: string }): { subject: string; html: string } {
  const source = escapeHtml(input.sourceUrl);
  const target = escapeHtml(input.targetUrl);
  const panel = `${input.siteUrl}/dashboard/backlinks`;
  if (kind === "lost") {
    return {
      subject: "A backlink you track seems to be gone",
      html: `<p>On our last two checks, <strong>${source}</strong> loaded fine but no longer linked to <strong>${target}</strong>.</p><p>The link may have been removed. If you ordered it through LinkLazy, you can open the order and raise a dispute; otherwise contact the site owner.</p><p><a href="${panel}">View your backlinks</a></p>`,
    };
  }
  return {
    subject: "Good news: your backlink is back",
    html: `<p>The link from <strong>${source}</strong> to <strong>${target}</strong> is live again.</p><p><a href="${panel}">View your backlinks</a></p>`,
  };
}

/** Best-effort email to the owner. Never throws; returns whether it was sent. */
export async function sendBacklinkNotice(
  svc: SupabaseClient,
  row: { user_id: string; source_url: string; target_url: string },
  kind: "lost" | "restored"
): Promise<boolean> {
  try {
    const { data } = await svc.auth.admin.getUserById(row.user_id);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildBacklinkEmail(kind, { sourceUrl: row.source_url, targetUrl: row.target_url, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    return (await sendEmail({ to: email, subject: mail.subject, html: mail.html })).ok;
  } catch {
    return false;
  }
}
