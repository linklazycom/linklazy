import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/site-settings";

const replySchema = z.object({
  message: z.string().trim().min(1).max(3000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Session-based client — RLS policy "users can reply on their own
  // tickets" enforces that this insert only succeeds if the ticket
  // actually belongs to the logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, name, subject, status")
    .eq("id", id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { error: msgError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: id,
    sender_type: "user",
    sender_name: ticket.name,
    body: parsed.data.message,
  });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  if (ticket.status !== "open") {
    await supabase.from("support_tickets").update({ status: "open" }).eq("id", id);
  }

  const settings = await getSiteSettings();
  const adminEmail = settings.contact_email as string;
  if (adminEmail) {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    await sendEmail({
      to: adminEmail,
      subject: `New reply on ticket: ${ticket.subject}`,
      html: `<p><strong>${escapeHtml(ticket.name)}</strong> replied:</p><p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br/>")}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/support/${id}">View in admin</a></p>`,
    });
  }

  return NextResponse.json({ ok: true });
}
