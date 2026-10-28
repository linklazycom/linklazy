import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import {
  PRESS_STATUSES,
  canMovePress,
  validateDeliveryUrl,
  validateSupplierCost,
  type PressStatus,
} from "@/lib/press-release-flow";
import { notifyPressStatus } from "@/lib/press-release-notify";

const schema = z.object({
  status: z.enum(PRESS_STATUSES as [PressStatus, ...PressStatus[]]),
  admin_note: z.string().trim().max(2000).nullable().optional(),
  delivery_url: z.string().max(700).nullable().optional(),
  expected_delivery_date: z.string().max(10).nullable().optional(), // YYYY-MM-DD or empty
  supplier_name: z.string().trim().max(120).nullable().optional(),
  supplier_cost: z.union([z.number(), z.string()]).nullable().optional(),
  internal_note: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Updates a press-release order (Batch 19B):
 *  - status moves follow PRESS_TRANSITIONS ("published"/"cancelled" are final)
 *  - "published" needs an https delivery link
 *  - the client is emailed when the status changes (best effort; response says emailSent)
 *  - supplier / cost / internal note go to the admin-only press_release_fulfillment table
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const input = parsed.data;
  const { id } = await params;

  const service = createServiceClient();
  const { data: order } = await service
    .from("press_release_orders")
    .select("id, user_id, headline, status, delivery_url, expected_delivery_at")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changed = order.status !== input.status;
  if (!canMovePress(order.status as string, input.status)) {
    return NextResponse.json({ error: `A ${String(order.status).replaceAll("_", " ")} order cannot be moved to ${input.status.replaceAll("_", " ")}.` }, { status: 409 });
  }

  let deliveryUrl: string | null = (order.delivery_url as string | null) ?? null;
  if (input.delivery_url !== undefined) {
    const raw = (input.delivery_url ?? "").trim();
    if (raw) {
      const checked = validateDeliveryUrl(raw);
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
      deliveryUrl = checked.value;
    } else {
      deliveryUrl = null;
    }
  }
  if (input.status === "published") {
    const checked = validateDeliveryUrl(deliveryUrl);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  let expectedAt: string | null = (order.expected_delivery_at as string | null) ?? null;
  if (input.expected_delivery_date !== undefined) {
    const raw = (input.expected_delivery_date ?? "").trim();
    if (!raw) expectedAt = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(new Date(`${raw}T00:00:00Z`).getTime())) {
      expectedAt = new Date(`${raw}T00:00:00Z`).toISOString();
    } else {
      return NextResponse.json({ error: "Expected delivery must be a date (YYYY-MM-DD)." }, { status: 400 });
    }
  }

  const cost = validateSupplierCost(input.supplier_cost);
  if (!cost.ok) return NextResponse.json({ error: cost.error }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.status,
    admin_note: input.admin_note ?? null,
    delivery_url: deliveryUrl,
    expected_delivery_at: expectedAt,
  };
  if (changed) {
    update.status_changed_at = now;
    if (input.status === "published") update.delivered_at = now;
  }

  // Claim the change atomically so two admins cannot both "move" the same order.
  const { data: claimed, error } = await service
    .from("press_release_orders")
    .update(update)
    .eq("id", id)
    .eq("status", order.status as string)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "This order was just updated. Refresh and try again." }, { status: 409 });
  }

  // Admin-only fields (never visible to the client).
  if (input.supplier_name !== undefined || input.supplier_cost !== undefined || input.internal_note !== undefined) {
    const { error: fulfillError } = await service.from("press_release_fulfillment").upsert(
      {
        order_id: id,
        supplier_name: input.supplier_name || null,
        supplier_cost: cost.value,
        internal_note: input.internal_note || null,
        updated_at: now,
      },
      { onConflict: "order_id" }
    );
    if (fulfillError) {
      return NextResponse.json({ ok: true, warning: "The order was saved, but supplier details could not be saved. Try again." });
    }
  }

  let emailSent: boolean | null = null;
  if (changed) {
    emailSent = await notifyPressStatus(service, order.user_id as string, {
      status: input.status,
      headline: order.headline as string,
      note: input.admin_note,
      deliveryUrl,
      expectedAt,
    });
  }
  return NextResponse.json({ ok: true, emailSent });
}
