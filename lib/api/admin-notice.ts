import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: the email an owner gets when an admin revokes one of their API keys. The key itself is never included, only its first characters. */
export function buildApiKeyRevokedEmail(input: { name: string; prefix: string; note?: string | null; siteUrl: string }): { subject: string; html: string } {
  const note = input.note ? `<p><strong>Reason:</strong> ${escapeHtml(input.note)}</p>` : "";
  return {
    subject: "One of your API keys was revoked",
    html: `<p>Your API key <strong>${escapeHtml(input.name)}</strong> (starts with <code>${escapeHtml(input.prefix)}</code>) was revoked by the LinkLazy team and no longer works.</p>${note}<p>If you still need the API, you can create a new key in your dashboard. If you think this was a mistake, please contact us.</p><p><a href="${input.siteUrl}/dashboard/support">Contact support</a></p>`,
  };
}

/** Best-effort email to the key owner. Never throws; returns whether it was sent. */
export async function notifyApiKeyOwner(svc: SupabaseClient, userId: string, input: { name: string; prefix: string; note?: string | null }): Promise<boolean> {
  try {
    const { data } = await svc.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildApiKeyRevokedEmail({ ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    return (await sendEmail({ to: email, subject: mail.subject, html: mail.html })).ok;
  } catch {
    return false;
  }
}
