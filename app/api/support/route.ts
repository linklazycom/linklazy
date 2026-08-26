import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/site-settings";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(3000),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const { allowed } = await checkRateLimit("support_ticket", ip, { max: 5, windowMinutes: 60 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many tickets submitted. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, subject, message } = parsed.data;

  // If the visitor happens to be logged in, link the ticket to their
  // account so it shows up under Dashboard → My Tickets. Guests (no
  // session) still get a working ticket via the access_token flow.
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const supabase = createServiceClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ name, email, subject, user_id: user?.id ?? null })
    .select("id, access_token")
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: ticketError?.message ?? "Could not create ticket" }, { status: 500 });
  }

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    sender_type: "user",
    sender_name: name,
    body: message,
  });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  // Notify the admin inbox — best-effort, doesn't block ticket creation if email isn't configured.
  const settings = await getSiteSettings();
  const adminEmail = settings.contact_email as string;
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New support ticket: ${subject}`,
      html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) opened a new ticket:</p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/support/${ticket.id}">View in admin</a></p>`,
    });
  }

  // Confirmation to the ticket creator, with their access link — this is
  // their only way back into the thread if they're a guest (not logged
  // in) and close the tab without bookmarking the URL the frontend
  // redirects them to. Without this, a guest who loses that tab has no
  // way to ever see the admin's reply.
  const ticketUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/support/${ticket.id}?token=${ticket.access_token}`;
  await sendEmail({
    to: email,
    subject: `We got your message: ${subject}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks for reaching out — we've received your message and will reply soon.</p><p><a href="${ticketUrl}">View your ticket</a> any time to check for a reply. Save this link — it's the only way to get back to this conversation.</p>`,
  });

  return NextResponse.json({ id: ticket.id, access_token: ticket.access_token });
}
