import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const disputeSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["accepted", "cancelled", "refunded"].includes(order.status)) {
    return NextResponse.json(
      { error: "This order is already closed and can't be disputed" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error: disputeError } = await supabase.from("disputes").insert({
    order_id: orderId,
    raised_by: user.id,
    reason: parsed.data.reason,
  });

  if (disputeError) return NextResponse.json({ error: disputeError.message }, { status: 500 });

  await supabase.from("orders").update({ status: "disputed" }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
