import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
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

  const { data: order } = await supabase
    .from("orders")
    .select("buyer_id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "accepted") {
    return NextResponse.json({ error: "You can only review completed orders" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const revieweeId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });

  if (error) {
    // Unique constraint (order_id, reviewer_id) — already reviewed
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already reviewed this order" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
