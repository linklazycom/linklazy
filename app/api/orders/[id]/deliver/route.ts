import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureArchiveSnapshot } from "@/lib/archive-snapshot";
import { z } from "zod";

const deliverSchema = z.object({
  proof_url: z.string().url(),
  proof_screenshot_url: z.string().url().optional(),
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

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Delivery is only allowed once the seller has accepted the order.
  // "awaiting_seller_site" stays allowed for any order that was already
  // in-flight before the accept/reject gate existed.
  if (!["awaiting_seller_site", "in_progress"].includes(order.status)) {
    return NextResponse.json(
      { error: "This order isn't ready for delivery yet." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const archiveUrl = await captureArchiveSnapshot(parsed.data.proof_url);

  const { error } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      proof_url: parsed.data.proof_url,
      proof_screenshot_url: parsed.data.proof_screenshot_url,
      delivered_at: new Date().toISOString(),
      last_link_check_at: new Date().toISOString(),
      last_link_check_ok: true,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, archiveUrl });
}
