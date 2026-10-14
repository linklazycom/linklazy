import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refundOrderToBuyer, type MoneyOrder } from "@/lib/order-money";

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * Seller declines a newly-placed order (status "pending_seller_acceptance").
 * For a paid order the buyer's payment is already sitting in escrow
 * (held_escrow) at this point — collected before the seller ever saw it,
 * same as the existing flow — so a rejection has to refund it back to the
 * buyer's wallet, not just flip a status. The refund itself lives in
 * lib/order-money.ts (atomic adjust_wallet_balance RPC via the service-role client).
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
    // Shared refund path (same one used by admin cancel/refund and disputes):
    // wallet payments go back to the buyer's wallet with a refund ledger type
    // (not "topup"), and a failed credit is reported instead of being ignored.
    const refund = await refundOrderToBuyer(
      service,
      order as MoneyOrder,
      "order rejected by seller before work started"
    );
    if (!refund.ok) {
      // Nothing was refunded, so re-open the order and let the seller retry.
      await service
        .from("orders")
        .update({ status: "pending_seller_acceptance", notes: order.notes })
        .eq("id", id)
        .eq("status", "cancelled");
      return NextResponse.json(
        { error: "Could not refund the buyer right now. The order is still open - please try again." },
        { status: 500 }
      );
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin/orders");

  return NextResponse.json({ ok: true });
}
