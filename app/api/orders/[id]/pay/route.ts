import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createBkashPayment } from "@/lib/bkash/client";
import { createPaypalOrder } from "@/lib/paypal/client";

const paySchema = z.object({
  provider: z.enum(["bkash", "paypal"]).default("bkash"),
});

/** Reads the platform's BDT-per-USD exchange rate (same source as /api/currency). */
async function getBdtPerUsd(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "bdt_per_usd")
    .maybeSingle();
  const rate = Number(data?.value ?? 125);
  return Number.isFinite(rate) && rate > 0 ? rate : 125;
}

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
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before paying for an order." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment provider" }, { status: 400 });
  }
  const { provider } = parsed.data;

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

  if (provider === "paypal") {
    try {
      const rate = await getBdtPerUsd(supabase);
      const usdAmount = Number((order.price_amount / rate).toFixed(2));

      const payment = await createPaypalOrder({
        amount: usdAmount,
        reference: order.id,
        returnUrl: `${siteUrl}/api/webhooks/paypal?order_id=${order.id}`,
        cancelUrl: `${siteUrl}/dashboard/orders/${order.id}?payment=cancelled`,
      });

      await supabase.from("payments").insert({
        order_id: order.id,
        payer_id: user.id,
        provider: "paypal",
        provider_txn_id: payment.id,
        amount: usdAmount,
        currency: "USD",
        status: "initiated",
      });

      return NextResponse.json({ redirectUrl: payment.approvalUrl });
    } catch (err) {
      return NextResponse.json(
        { error: `Payment could not be started: ${(err as Error).message}` },
        { status: 502 }
      );
    }
  }

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
