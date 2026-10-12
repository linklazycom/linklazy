import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refundOrderToBuyer, releaseOrderToSeller } from "@/lib/order-money";
import { z } from "zod";

const resolveSchema = z.object({
  resolution: z.enum(["resolved_buyer", "resolved_seller"]),
  notes: z.string().trim().max(2000).optional(),
});

const OPEN_STATES = ["open", "under_review"];

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

  const service = createServiceClient();

  const { data: dispute } = await service
    .from("disputes")
    .select("id, order_id, status")
    .eq("id", disputeId)
    .single();
  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!OPEN_STATES.includes(dispute.status)) {
    return NextResponse.json({ error: "This dispute is already resolved." }, { status: 409 });
  }

  const body = await request.json();
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: order } = await service
    .from("orders")
    .select("id, order_type, price_amount, buyer_id, seller_id, site_id")
    .eq("id", dispute.order_id)
    .single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Atomic claim: only one request can resolve a dispute (the old code wrote the
  // result with the admin's own session, but the disputes table has no UPDATE
  // policy, so the dispute silently stayed "open" and could be resolved again).
  const { data: claimed } = await service
    .from("disputes")
    .update({
      status: parsed.data.resolution,
      admin_id: user.id,
      resolution_notes: parsed.data.notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .in("status", OPEN_STATES)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "This dispute was just resolved by someone else." }, { status: 409 });
  }

  async function undo() {
    await service.from("orders").update({ status: "disputed", accepted_at: null }).eq("id", order!.id);
    await service
      .from("disputes")
      .update({ status: "under_review", admin_id: null, resolution_notes: null, resolved_at: null })
      .eq("id", disputeId);
  }

  let manualProviderRefund = false;

  if (parsed.data.resolution === "resolved_buyer") {
    // Buyer wins: order refunded, escrowed payment returned.
    await service.from("orders").update({ status: "refunded" }).eq("id", order.id);
    const refund = await refundOrderToBuyer(service, order, "dispute resolved in buyer's favor");
    if (!refund.ok) {
      await undo();
      return NextResponse.json(
        { error: `Refund failed, dispute left open: ${refund.error}` },
        { status: 500 }
      );
    }
    manualProviderRefund = refund.manualProviderRefund === true;
  } else {
    // Seller wins: order stands as accepted, escrow releases, seller is paid —
    // same payout rules as the buyer-accept flow.
    await service
      .from("orders")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", order.id);
    const payout = await releaseOrderToSeller(service, order, " (dispute resolved in seller's favor)");
    if (!payout.ok) {
      await undo();
      return NextResponse.json(
        { error: `Payout failed, dispute left open: ${payout.error}` },
        { status: 500 }
      );
    }
  }

  await service.from("admin_logs").insert({
    admin_id: user.id,
    action: `dispute_${parsed.data.resolution}`,
    target_table: "disputes",
    target_id: disputeId,
    metadata: { notes: parsed.data.notes, manual_provider_refund_needed: manualProviderRefund },
  });

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${dispute.order_id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/revenue");

  return NextResponse.json({
    ok: true,
    ...(manualProviderRefund
      ? { warning: "This payment was made via bKash/PayPal: return the money through the provider manually." }
      : {}),
  });
}
