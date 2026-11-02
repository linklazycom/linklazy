import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/**
 * A project an admin has paused (Batch 23B). A paused project cannot start new work that costs us money or reaches outside
 * (Opportunity searches, AI drafts, new backlink monitors) and cannot be deleted until it is restored. What the owner already saved
 * stays visible. The mark lives in projects.suspended_at (SQL 071).
 */
export const PROJECT_PAUSED_MESSAGE = "This project was paused by the LinkLazy team. Please contact support if you think this is a mistake.";

/** True only when the project is paused. Any error (for example SQL 071 not applied yet) counts as "not paused": the tools keep working. */
export async function isProjectSuspended(db: SupabaseClient, projectId: string): Promise<boolean> {
  try {
    const { data, error } = await db.from("projects").select("suspended_at").eq("id", projectId).maybeSingle();
    if (error) return false;
    return Boolean((data as { suspended_at?: string | null } | null)?.suspended_at);
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: the email a project owner gets when an admin pauses or restores a project. */
export function buildProjectNoticeEmail(kind: "suspend" | "restore", input: { name: string; note?: string | null; siteUrl: string }): { subject: string; html: string } {
  const name = escapeHtml(input.name);
  const note = input.note ? `<p><strong>Reason:</strong> ${escapeHtml(input.note)}</p>` : "";
  if (kind === "suspend") {
    return {
      subject: "One of your projects was paused",
      html: `<p>Your project <strong>${name}</strong> was paused by the LinkLazy team. While it is paused it cannot run new searches, drafts or monitors.</p>${note}<p>If you think this was a mistake, please contact us and we will review it.</p><p><a href="${input.siteUrl}/dashboard/support">Contact support</a></p>`,
    };
  }
  return { subject: "Your project is active again", html: `<p>Your project <strong>${name}</strong> is active again after review.</p>${note}` };
}

/** Best-effort email to the project owner. Never throws; returns whether it was sent. */
export async function notifyProjectOwner(svc: SupabaseClient, userId: string, kind: "suspend" | "restore", input: { name: string; note?: string | null }): Promise<boolean> {
  try {
    const { data } = await svc.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildProjectNoticeEmail(kind, { ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    return (await sendEmail({ to: email, subject: mail.subject, html: mail.html })).ok;
  } catch {
    return false;
  }
}
