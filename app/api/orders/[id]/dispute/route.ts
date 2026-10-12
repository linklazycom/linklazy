import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

const disputeSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Participation is checked with the user's own session (RLS).
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["accepted", "cancelled", "refunded"].includes(order.status)) {
    return NextResponse.json(
      { error: "This order is already closed and can't be disputed" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // The disputes table has no INSERT policy for normal sessions, so the write
  // happens with the service client (after the checks above).
  const service = createServiceClient();

  const { data: existing } = await service
    .from("disputes")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["open", "under_review"])
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "A dispute is already open for this order." }, { status: 409 });
  }

  const { error: disputeError } = await service.from("disputes").insert({
    order_id: orderId,
    raised_by: user.id,
    reason: parsed.data.reason,
  });
  if (disputeError) return NextResponse.json({ error: disputeError.message }, { status: 500 });

  await service.from("orders").update({ status: "disputed" }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
