import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/site-settings";

async function getTicketByToken(id: string, token: string) {
  const supabase = createServiceClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, name, email, subject, status, access_token, created_at")
    .eq("id", id)
    .single();

  if (!ticket || ticket.access_token !== token) return null;
  return { supabase, ticket };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const result = await getTicketByToken(id, token);
  if (!result) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { supabase, ticket } = result;
  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("id, sender_type, sender_name, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ticket, messages: messages ?? [] });
}

const replySchema = z.object({
  token: z.string().min(1),
  message: z.string().trim().min(1).max(3000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await getTicketByToken(id, parsed.data.token);
  if (!result) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { supabase, ticket } = result;

  // A closed ticket that gets a new user reply reopens automatically.
  if (ticket.status === "closed") {
    await supabase.from("support_tickets").update({ status: "open" }).eq("id", id);
  } else if (ticket.status === "replied") {
    await supabase.from("support_tickets").update({ status: "open" }).eq("id", id);
  }

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: id,
    sender_type: "user",
    sender_name: ticket.name,
    body: parsed.data.message,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings = await getSiteSettings();
  const adminEmail = settings.contact_email as string;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New reply on ticket: ${ticket.subject}`,
      html: `<p><strong>${ticket.name}</strong> replied:</p><p>${parsed.data.message}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/support/${id}">View in admin</a></p>`,
    });
  }

  return NextResponse.json({ ok: true });
}
