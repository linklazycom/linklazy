import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";

// Admin override for an order's lifecycle — separate from the buyer/seller
// dispute flow (which has its own resolve endpoint and its own record of
// *why*). This is for cases with no formal dispute: a stuck order, a
// seller who's gone unresponsive, a mistaken order, etc. Every action here
// is logged to admin_logs so there's a trail of who overrode what.
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
  const { supabase, adminId } = admin;

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, order_type, deadline_at")
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

  switch (parsed.data.action) {
    case "cancel": {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
      if (order.order_type === "paid") {
        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("order_id", id)
          .eq("status", "held_escrow");
      }
      break;
    }
    case "refund": {
      await supabase.from("orders").update({ status: "refunded" }).eq("id", id);
      if (order.order_type === "paid") {
        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("order_id", id)
          .eq("status", "held_escrow");
      }
      break;
    }
    case "force_accept": {
      await supabase
        .from("orders")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", id);
      if (order.order_type === "paid") {
        await supabase
          .from("payments")
          .update({ status: "released" })
          .eq("order_id", id)
          .eq("status", "held_escrow");
      }
      break;
    }
    case "extend_deadline": {
      const hours = parsed.data.extend_hours ?? 24;
      const base = order.deadline_at ? new Date(order.deadline_at) : new Date();
      const newDeadline = new Date(base.getTime() + hours * 3600 * 1000);
      await supabase.from("orders").update({ deadline_at: newDeadline.toISOString() }).eq("id", id);
      break;
    }
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: `order_${parsed.data.action}`,
    target_table: "orders",
    target_id: id,
    metadata: { note: parsed.data.note, previous_status: order.status },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);

  return NextResponse.json({ ok: true });
}
