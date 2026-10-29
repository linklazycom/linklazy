import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: the email a link owner gets when an admin takes a short link down or puts it back. */
export function buildLinkNoticeEmail(
  kind: "takedown" | "restore",
  input: { slug: string; note?: string | null; siteUrl: string }
): { subject: string; html: string } {
  const slug = escapeHtml(input.slug);
  const note = input.note ? `<p><strong>Reason:</strong> ${escapeHtml(input.note)}</p>` : "";
  const support = `${input.siteUrl}/support`;
  if (kind === "takedown") {
    return {
      subject: "One of your short links was turned off",
      html: `<p>Your short link <strong>/${slug}</strong> was turned off because it may break our acceptable-use rules for short links.</p>${note}<p>If you think this was a mistake, please contact us and we will review it.</p><p><a href="${support}">Contact support</a></p>`,
    };
  }
  return {
    subject: "Your short link is back on",
    html: `<p>Your short link <strong>/${slug}</strong> has been turned back on after review.</p>${note}`,
  };
}

/** Best-effort email to the link owner. Never throws; returns whether it was sent. */
export async function notifyLinkOwner(
  svc: SupabaseClient,
  userId: string,
  kind: "takedown" | "restore",
  input: { slug: string; note?: string | null }
): Promise<boolean> {
  try {
    const { data } = await svc.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildLinkNoticeEmail(kind, { ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    return (await sendEmail({ to: email, subject: mail.subject, html: mail.html })).ok;
  } catch {
    return false;
  }
}
