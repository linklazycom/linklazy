import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBkashPayment } from "@/lib/bkash/client";

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
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.order_type !== "paid" || order.status !== "pending_payment") {
    return NextResponse.json({ error: "This order isn't awaiting payment" }, { status: 400 });
  }
  if (!order.price_amount) {
    return NextResponse.json({ error: "Order has no price set" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const payment = await createBkashPayment({
      amount: order.price_amount,
      orderId: order.id,
      callbackURL: `${siteUrl}/api/webhooks/bkash?order_id=${order.id}`,
    });

    await supabase.from("payments").insert({
      order_id: order.id,
      payer_id: user.id,
      provider: "bkash",
      provider_txn_id: payment.paymentID,
      amount: order.price_amount,
      currency: "BDT",
      status: "initiated",
    });

    return NextResponse.json({ redirectUrl: payment.bkashURL });
  } catch (err) {
    return NextResponse.json(
      { error: `Payment could not be started: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
