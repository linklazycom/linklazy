import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPressReleaseOrderSchema } from "@/lib/validators/press-release";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in to place an order" }, { status: 401 });

  const parsed = createPressReleaseOrderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;

  const { data: products, error: productsError } = await supabase
    .from("press_release_products")
    .select("id, name, price_amount, active")
    .in("id", input.product_ids)
    .eq("active", true);
  if (productsError || !products || products.length !== input.product_ids.length) {
    return NextResponse.json({ error: "One or more selected options are no longer available" }, { status: 400 });
  }

  const unitTotal = products.reduce((sum, product) => sum + Number(product.price_amount), 0);
  const total = unitTotal * input.quantity;
  const { data: order, error } = await supabase
    .from("press_release_orders")
    .insert({
      user_id: user.id, quantity: input.quantity, headline: input.headline,
      website_url: input.website_url, target_url: input.target_url, summary: input.summary,
      notes: input.notes || null, total_amount: total, status: "pending_review",
    })
    .select("id")
    .single();
  if (error || !order) return NextResponse.json({ error: error?.message ?? "Could not create the order" }, { status: 500 });

  const { error: itemError } = await supabase.from("press_release_order_items").insert(
    products.map((product) => ({ order_id: order.id, product_id: product.id, product_name: product.name, unit_price: product.price_amount }))
  );
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  return NextResponse.json({ id: order.id });
}
