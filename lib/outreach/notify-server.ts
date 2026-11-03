import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/site-settings";
import type { TicketKind } from "@/lib/outreach/reply";
import { OUTREACH_NOTIFY_KEY, buildReplyNoticeEmail, isNotifyOn } from "@/lib/outreach/notify";

/** Best effort: tells the admin about a new reply. Returns whether an email went out. Never throws. */
export async function notifyAdminOfReply(
  service: SupabaseClient,
  input: { email: string; subject?: string | null; preview?: string | null; kind: TicketKind; ticketId: string }
): Promise<boolean> {
  try {
    if (input.kind === "auto_reply") return false;
    const { data } = await service.from("site_settings").select("value").eq("key", OUTREACH_NOTIFY_KEY).maybeSingle();
    if (!isNotifyOn(data?.value)) return false;
    const to = (await getSiteSettings()).contact_email;
    if (typeof to !== "string" || !to.includes("@")) return false;
    const mail = buildReplyNoticeEmail({ ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    return (await sendEmail({ to, subject: mail.subject, html: mail.html })).ok;
  } catch {
    return false;
  }
}
