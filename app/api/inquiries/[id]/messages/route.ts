import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterContactInfo } from "@/lib/chat-filter";
import { z } from "zod";

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("buyer_id, seller_id")
    .eq("id", id)
    .single();

  if (!inquiry || (inquiry.buyer_id !== user.id && inquiry.seller_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { filtered, wasFiltered } = filterContactInfo(parsed.data.body);

  const { error } = await supabase.from("inquiry_messages").insert({
    inquiry_id: id,
    sender_id: user.id,
    body: filtered,
    was_filtered: wasFiltered,
    original_body: wasFiltered ? parsed.data.body : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("inquiries").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, wasFiltered });
}
