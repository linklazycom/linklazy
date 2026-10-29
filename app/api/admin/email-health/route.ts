import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { sendEmail } from "@/lib/email";
import { lookupEmailDns, parseFromDomain } from "@/lib/email-health";

/** GET: is email configured, and do the DNS records for the sending domain look right (values are never shown). */
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const from = process.env.EMAIL_FROM;
  const domain = parseFromDomain(from);
  const findings = domain ? await lookupEmailDns(domain) : [];
  return NextResponse.json({ apiKeySet: !!process.env.RESEND_API_KEY, fromSet: !!from, domain, findings });
}

/** POST: send one test email to the admin's own address and report Resend's answer. */
export async function POST() {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { data } = await admin.supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  const result = await sendEmail({ to: email, subject: "LinkLazy test email", html: "<p>This is a test email from Admin &gt; Operations. If you can read it, sending works.</p>" });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error ?? "Send failed" }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: email });
}
