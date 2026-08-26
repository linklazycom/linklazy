import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { sendEmail } from "@/lib/email";

const replySchema = z.object({
  message: z.string().trim().min(1).max(3000),
  close: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { supabase } = admin;

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, name, email, subject, access_token, user_id")
    .eq("id", id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { error: msgError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: id,
    sender_type: "admin",
    sender_name: "LinkLazy Support",
    body: parsed.data.message,
  });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  const { error: statusError } = await supabase
    .from("support_tickets")
    .update({ status: parsed.data.close ? "closed" : "replied" })
    .eq("id", id);

  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // No inbound-email handler exists — a reply to this email address goes
  // nowhere, so the message can't tell the customer to "reply to this
  // email" (it used to, which silently swallowed any reply they sent).
  // Logged-in ticket owners land on their dashboard thread; guests need
  // the token link since that's their only way back in.
  const ticketUrl = ticket.user_id
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard/support/${id}`
    : `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/support/${id}?token=${ticket.access_token}`;

  await sendEmail({
    to: ticket.email,
    subject: `Re: ${ticket.subject}`,
    html: `<p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br/>")}</p><p style="color:#6B7280;font-size:12px;margin-top:16px;"><a href="${ticketUrl}">View and reply on our support page</a> — replies to this email address aren't monitored.</p>`,
  });

  return NextResponse.json({ ok: true });
}
