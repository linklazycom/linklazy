import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller accepts a newly-placed order (status "pending_seller_acceptance")
 * and work can begin. Distinct from /api/orders/[id]/accept, which is the
 * *buyer's* acceptance of a finished delivery — different party, different
 * stage of the same order.
 */
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
  if (!order || order.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "pending_seller_acceptance") {
    return NextResponse.json({ error: "This order isn't awaiting your response" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "in_progress" })
    .eq("id", id)
    .eq("status", "pending_seller_acceptance");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin/orders");

  return NextResponse.json({ ok: true });
}
