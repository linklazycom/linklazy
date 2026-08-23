import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/lib/validators/order";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id, status, price_amount, turnaround_hours, accepts_exchange, accepts_paid")
    .eq("id", input.site_id)
    .single();

  if (!site || site.status !== "approved") {
    return NextResponse.json({ error: "Site not available" }, { status: 404 });
  }
  if (site.owner_id === user.id) {
    return NextResponse.json({ error: "You can't order a link from your own site" }, { status: 400 });
  }
  if (input.order_type === "exchange" && !site.accepts_exchange) {
    return NextResponse.json({ error: "This site doesn't accept exchanges" }, { status: 400 });
  }
  if (input.order_type === "paid" && !site.accepts_paid) {
    return NextResponse.json({ error: "This site doesn't accept paid orders" }, { status: 400 });
  }
  if (input.order_type === "exchange" && !input.buyer_site_id) {
    return NextResponse.json(
      { error: "List your own site to propose an exchange" },
      { status: 400 }
    );
  }

  let commissionAmount: number | undefined;
  let commissionRate: number | undefined;

  if (input.order_type === "paid") {
    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "commission_rate_default")
      .single();
    commissionRate = Number(setting?.value ?? 17.5);
    commissionAmount = site.price_amount
      ? Math.round((site.price_amount * commissionRate) / 100)
      : 0;
  }

  const deadline = new Date(Date.now() + (site.turnaround_hours ?? 48) * 3600 * 1000);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: site.owner_id,
      site_id: site.id,
      slot_id: input.slot_id,
      buyer_site_id: input.order_type === "exchange" ? input.buyer_site_id : null,
      order_type: input.order_type,
      status: input.order_type === "paid" ? "pending_payment" : "awaiting_seller_site",
      target_url: input.target_url,
      anchor_text: input.anchor_text,
      notes: input.notes,
      price_amount: input.order_type === "paid" ? site.price_amount : null,
      commission_amount: commissionAmount,
      commission_rate: commissionRate,
      deadline_at: deadline.toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ id: order.id });
}
