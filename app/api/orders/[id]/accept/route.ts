import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { commissionRateForCumulative, startOfCurrentMonthISO } from "@/lib/commission";

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

  // Release escrowed payment and pay the seller, if this was a paid order.
  // Commission is finalized here (not at order creation) because it's
  // tiered on the seller's cumulative sales for the current calendar
  // month — see lib/commission.ts.
  if (order.order_type === "paid" && order.price_amount) {
    // Service-role client: this sum needs to see every one of the
    // seller's orders regardless of RLS, and the wallet credit below is
    // a privileged write the buyer's own session shouldn't have.
    const service = createServiceClient();

    const monthStart = startOfCurrentMonthISO();
    const { data: priorOrders } = await service
      .from("orders")
      .select("price_amount")
      .eq("seller_id", order.seller_id)
      .eq("order_type", "paid")
      .eq("status", "accepted")
      .gte("accepted_at", monthStart)
      .neq("id", id);

    const priorMonthTotal = (priorOrders ?? []).reduce(
      (sum, o) => sum + (o.price_amount ?? 0),
      0
    );
    const cumulativeAfterThisOrder = priorMonthTotal + order.price_amount;
    const commissionRate = commissionRateForCumulative(cumulativeAfterThisOrder);
    const commissionAmount = Math.round((order.price_amount * commissionRate) / 100);
    const sellerEarning = order.price_amount - commissionAmount;

    await service
      .from("orders")
      .update({ commission_rate: commissionRate, commission_amount: commissionAmount })
      .eq("id", id);

    await service
      .from("payments")
      .update({ status: "released" })
      .eq("order_id", id)
      .eq("status", "held_escrow");

    const { error: creditError } = await service.rpc("adjust_wallet_balance", {
      p_user_id: order.seller_id,
      p_delta: sellerEarning,
      p_type: "seller_earning",
      p_related_site_id: order.site_id,
      p_related_user_id: order.buyer_id,
      p_notes: `Order payout after ${commissionRate}% commission`,
    });

    if (creditError) {
      return NextResponse.json(
        { error: `Order accepted, but crediting seller failed: ${creditError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
