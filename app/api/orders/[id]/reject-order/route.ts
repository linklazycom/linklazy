import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * Seller declines a newly-placed order (status "pending_seller_acceptance").
 * For a paid order the buyer's payment is already sitting in escrow
 * (held_escrow) at this point — collected before the seller ever saw it,
 * same as the existing flow — so a rejection has to refund it back to the
 * buyer's wallet, not just flip a status. Uses the atomic adjust_wallet_balance
 * RPC (see sql/001_atomic_wallet_adjust.sql) via the service-role client,
 * since that function is only grantable to service_role.
 */
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

  const body = await request.json().catch(() => ({}));
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "pending_seller_acceptance") {
    return NextResponse.json({ error: "This order isn't awaiting your response" }, { status: 400 });
  }

  const service = createServiceClient();

  // Claim the rejection first (only if still pending) so a double-click or
  // duplicate request can't refund the same escrowed payment twice.
  const { data: claimed } = await service
    .from("orders")
    .update({ status: "cancelled", notes: parsed.data.reason ? `Rejected by seller: ${parsed.data.reason}` : order.notes })
    .eq("id", id)
    .eq("status", "pending_seller_acceptance")
    .select("id");

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "This order was already responded to." }, { status: 409 });
  }

  if (order.order_type === "paid") {
    const { data: payment } = await service
      .from("payments")
      .update({ status: "refunded" })
      .eq("order_id", id)
      .eq("status", "held_escrow")
      .select("id, amount, currency")
      .maybeSingle();

    // Only wallet-collected payments are refunded straight back to the
    // wallet automatically — bKash/PayPal refunds go through the provider
    // and need manual admin handling (no automated reversal API wired up
    // for those yet), so leaving payment.status "refunded" here is the
    // marker for admin follow-up in that case.
    if (payment && order.price_amount) {
      const { data: paymentRow } = await service
        .from("payments")
        .select("provider")
        .eq("id", payment.id)
        .single();

      if (paymentRow?.provider === "wallet") {
        await service.rpc("adjust_wallet_balance", {
          p_user_id: order.buyer_id,
          p_delta: order.price_amount,
          p_type: "topup",
          p_related_site_id: order.site_id,
          p_notes: "Refund — order rejected by seller before work started",
        });
      }
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin/orders");

  return NextResponse.json({ ok: true });
}
