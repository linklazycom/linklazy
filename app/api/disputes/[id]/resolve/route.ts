import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { commissionRateForCumulative, startOfCurrentMonthISO } from "@/lib/commission";
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
    .select("id, order_type, price_amount, buyer_id, seller_id, site_id")
    .eq("id", dispute.order_id)
    .single();

  const service = createServiceClient();

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
      const { data: payment } = await service
        .from("payments")
        .update({ status: "refunded" })
        .eq("order_id", dispute.order_id)
        .eq("status", "held_escrow")
        .select("id, provider")
        .maybeSingle();

      // Marking the payment row "refunded" is just a label — it never
      // actually moved money. For wallet-collected payments we have to
      // additionally credit the buyer's wallet back ourselves (same as
      // the seller-rejects-order flow); bKash/PayPal payments still need
      // a manual refund through the provider, so leaving that payment
      // "refunded" here is the marker for admin follow-up, same
      // established pattern as reject-order.
      if (payment?.provider === "wallet" && order.price_amount) {
        await service.rpc("adjust_wallet_balance", {
          p_user_id: order.buyer_id,
          p_delta: order.price_amount,
          p_type: "topup",
          p_related_site_id: order.site_id,
          p_notes: "Refund — dispute resolved in buyer's favor",
        });
      }
    }
  } else {
    // Seller wins: order stands as accepted, escrowed payment releases and
    // the seller gets paid — same commission calc + wallet credit as the
    // normal buyer-accept flow (app/api/orders/[id]/accept/route.ts),
    // since a disputed order never goes through that route on its own.
    await supabase
      .from("orders")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", dispute.order_id);

    if (order?.order_type === "paid" && order.price_amount) {
      const monthStart = startOfCurrentMonthISO();
      const { data: priorOrders } = await service
        .from("orders")
        .select("price_amount")
        .eq("seller_id", order.seller_id)
        .eq("order_type", "paid")
        .eq("status", "accepted")
        .gte("accepted_at", monthStart)
        .neq("id", dispute.order_id);

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
        .eq("id", dispute.order_id);

      await service
        .from("payments")
        .update({ status: "released" })
        .eq("order_id", dispute.order_id)
        .eq("status", "held_escrow");

      const { error: creditError } = await service.rpc("adjust_wallet_balance", {
        p_user_id: order.seller_id,
        p_delta: sellerEarning,
        p_type: "seller_earning",
        p_related_site_id: order.site_id,
        p_related_user_id: order.buyer_id,
        p_notes: `Order payout after ${commissionRate}% commission (dispute resolved in seller's favor)`,
      });

      if (creditError) {
        return NextResponse.json(
          { error: `Dispute resolved, but crediting seller failed: ${creditError.message}` },
          { status: 500 }
        );
      }
    }
  }

  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action: `dispute_${parsed.data.resolution}`,
    target_table: "disputes",
    target_id: disputeId,
    metadata: { notes: parsed.data.notes },
  });

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${dispute.order_id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/revenue");

  return NextResponse.json({ ok: true });
}
