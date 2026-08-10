import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const resolveSchema = z.object({
  resolution: z.enum(["resolved_buyer", "resolved_seller"]),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: disputeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, order_id, status")
    .eq("id", disputeId)
    .single();
  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_type, price_amount")
    .eq("id", dispute.order_id)
    .single();

  await supabase
    .from("disputes")
    .update({
      status: parsed.data.resolution,
      admin_id: user.id,
      resolution_notes: parsed.data.notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (parsed.data.resolution === "resolved_buyer") {
    // Buyer wins: order is refunded/cancelled, escrowed payment refunded.
    await supabase.from("orders").update({ status: "refunded" }).eq("id", dispute.order_id);
    if (order?.order_type === "paid") {
      await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("order_id", dispute.order_id)
        .eq("status", "held_escrow");
    }
  } else {
    // Seller wins: order stands as accepted, escrowed payment releases.
    await supabase
      .from("orders")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", dispute.order_id);
    if (order?.order_type === "paid") {
      await supabase
        .from("payments")
        .update({ status: "released" })
        .eq("order_id", dispute.order_id)
        .eq("status", "held_escrow");
    }
  }

  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: `dispute_${parsed.data.resolution}`,
    target_table: "disputes",
    target_id: disputeId,
    metadata: { notes: parsed.data.notes },
  });

  return NextResponse.json({ ok: true });
}
