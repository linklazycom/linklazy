import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { refundOrderToBuyer, releaseOrderToSeller } from "@/lib/order-money";

// Admin override for an order's lifecycle — separate from the buyer/seller
// dispute flow (which has its own resolve endpoint and its own record of
// *why*). This is for cases with no formal dispute: a stuck order, a
// seller who's gone unresponsive, a mistaken order, etc. Every action here
// is logged to admin_logs so there's a trail of who overrode what.
//
// Money rules (see lib/order-money.ts):
//   force_accept -> the seller IS paid (price minus commission) from escrow
//   cancel/refund -> wallet payments go back to the buyer's wallet; bKash/PayPal
//                    payments are marked refunded and must be returned via the provider
const actionSchema = z.object({
  action: z.enum(["cancel", "refund", "force_accept", "extend_deadline"]),
  note: z.string().trim().max(1000).optional(),
  extend_hours: z.number().int().min(1).max(720).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId } = admin;
  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("id, status, order_type, deadline_at, price_amount, buyer_id, seller_id, site_id")
    .eq("id", id)
    .single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const TERMINAL = ["accepted", "cancelled", "refunded"];
  if (parsed.data.action !== "extend_deadline" && TERMINAL.includes(order.status)) {
    return NextResponse.json(
      { error: `Order is already ${order.status} — nothing to override.` },
      { status: 409 }
    );
  }

  let manualProviderRefund = false;

  if (parsed.data.action === "extend_deadline") {
    const hours = parsed.data.extend_hours ?? 24;
    const base = order.deadline_at ? new Date(order.deadline_at) : new Date();
    const newDeadline = new Date(base.getTime() + hours * 3600 * 1000);
    await service.from("orders").update({ deadline_at: newDeadline.toISOString() }).eq("id", id);
  } else {
    const newStatus =
      parsed.data.action === "cancel" ? "cancelled" : parsed.data.action === "refund" ? "refunded" : "accepted";

    // Atomic claim: only one request can move the order out of its current status.
    const { data: claimed, error } = await service
      .from("orders")
      .update(
        newStatus === "accepted"
          ? { status: newStatus, accepted_at: new Date().toISOString() }
          : { status: newStatus }
      )
      .eq("id", id)
      .eq("status", order.status)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: "The order changed in the meantime — reload and try again." }, { status: 409 });
    }

    const result =
      newStatus === "accepted"
        ? await releaseOrderToSeller(service, order, " (admin force accept)")
        : await refundOrderToBuyer(service, order, `order ${newStatus} by admin`);

    if (!result.ok) {
      // Money did not move, so put the order back exactly as it was.
      await service
        .from("orders")
        .update({ status: order.status, accepted_at: null })
        .eq("id", id)
        .eq("status", newStatus);
      return NextResponse.json({ error: `Money step failed, order not changed: ${result.error}` }, { status: 500 });
    }
    manualProviderRefund = result.manualProviderRefund === true;
  }

  // Service client: admin_logs has no INSERT policy for sessions.
  await service.from("admin_logs").insert({
    admin_id: adminId,
    action: `order_${parsed.data.action}`,
    target_table: "orders",
    target_id: id,
    metadata: {
      note: parsed.data.note,
      previous_status: order.status,
      manual_provider_refund_needed: manualProviderRefund,
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);

  return NextResponse.json({
    ok: true,
    ...(manualProviderRefund
      ? { warning: "This payment was made via bKash/PayPal: return the money through the provider manually." }
      : {}),
  });
}
