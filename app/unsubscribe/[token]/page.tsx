import { createServiceClient } from "@/lib/supabase/service";
import { UnsubscribeForm } from "@/components/outreach/unsubscribe-form";
import { maskEmail } from "@/lib/outreach/email";
import { getUnsubscribeSecret, parseUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/outreach/token";

export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Opening this page never unsubscribes anyone (mail scanners open links); the person must press the button. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = getUnsubscribeSecret();
  const parsed = parseUnsubscribeToken(token);
  let email: string | null = null;
  if (secret && parsed) {
    const { data } = await createServiceClient().from("outreach_contacts").select("email").eq("id", parsed.id).maybeSingle();
    if (data && verifyUnsubscribeToken(secret, parsed, data.email)) email = data.email;
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <h1 className="font-display text-2xl font-medium">Unsubscribe</h1>
      {email ? <UnsubscribeForm token={token} email={maskEmail(email)} /> : <p className="text-sm text-muted">This unsubscribe link is not valid or has expired. If you keep receiving emails you do not want, reply to the message and tell us.</p>}
    </main>
  );
}
