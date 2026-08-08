import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "delivered") {
    return NextResponse.json({ error: "Order isn't awaiting acceptance" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Release escrowed payment, if this was a paid order.
  if (order.order_type === "paid") {
    await supabase
      .from("payments")
      .update({ status: "released" })
      .eq("order_id", id)
      .eq("status", "held_escrow");
  }

  return NextResponse.json({ ok: true });
}
