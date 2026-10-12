import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { releaseOrderToSeller } from "@/lib/order-money";

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

  const service = createServiceClient();
  const isPaid = order.order_type === "paid" && !!order.price_amount;

  // SECURITY: a paid order may only be accepted (and the seller paid) if the
  // buyer's money is really held in escrow for it.
  if (isPaid) {
    const { data: held } = await service
      .from("payments")
      .select("id")
      .eq("order_id", id)
      .eq("status", "held_escrow");
    if (!held || held.length === 0) {
      return NextResponse.json(
        { error: "No held payment found for this order. Please contact support." },
        { status: 409 }
      );
    }
  }

  // Atomic claim: only one request can move delivered -> accepted, so a
  // double click or two concurrent requests can never pay the seller twice.
  const { data: claimed, error } = await service
    .from("orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "delivered")
    .eq("buyer_id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Order isn't awaiting acceptance" }, { status: 409 });
  }

  if (isPaid) {
    const result = await releaseOrderToSeller(service, order);
    if (!result.ok) {
      // Nothing was paid out, so re-open the order: the buyer can press Accept
      // again instead of leaving an "accepted" order whose seller was never paid.
      await service
        .from("orders")
        .update({ status: "delivered", accepted_at: null, commission_rate: null, commission_amount: null })
        .eq("id", id)
        .eq("status", "accepted");
      return NextResponse.json(
        { error: "Could not pay the seller right now. The order is still open — please try again." },
        { status: 500 }
      );
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin/orders");

  return NextResponse.json({ ok: true });
}
