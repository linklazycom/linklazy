import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { buildPressEmail, type PressStatus } from "@/lib/press-release-flow";

/** Best-effort status email to the client. Never throws; returns whether it was sent. */
export async function notifyPressStatus(
  service: SupabaseClient,
  userId: string,
  input: { status: PressStatus; headline: string; note?: string | null; deliveryUrl?: string | null; expectedAt?: string | null }
): Promise<boolean> {
  try {
    const { data } = await service.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildPressEmail({ ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" });
    const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
    return result.ok;
  } catch {
    return false;
  }
}
