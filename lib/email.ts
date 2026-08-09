/**
 * Thin wrapper around Resend for transactional email (saved-search alerts,
 * future order/dispute notifications). Requires RESEND_API_KEY and
 * EMAIL_FROM env vars in Vercel. If unset, sendEmail no-ops with a console
 * warning instead of throwing — so the rest of the app keeps working even
 * before email is configured.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("sendEmail skipped — RESEND_API_KEY or EMAIL_FROM not configured");
    return { ok: false, error: "Email not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend error ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
