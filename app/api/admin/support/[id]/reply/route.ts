import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

  // Session-based client — RLS policies on support_tickets /
  // support_ticket_messages restrict writes here to admins only, so a
  // non-admin session will simply fail this insert with a permissions error.
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, name, email, subject")
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

  await sendEmail({
    to: ticket.email,
    subject: `Re: ${ticket.subject}`,
    html: `<p>${parsed.data.message}</p><p style="color:#6B7280;font-size:12px;margin-top:16px;">Reply to this email, or continue the thread on our support page.</p>`,
  });

  return NextResponse.json({ ok: true });
}
