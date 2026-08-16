import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createBkashPayment } from "@/lib/bkash/client";
import { createPaypalOrder } from "@/lib/paypal/client";

const topupSchema = z.object({
  amount: z.coerce.number().int().min(50, "Minimum top-up is ৳50").max(50000, "Maximum top-up is ৳50,000"),
  provider: z.enum(["bkash", "paypal"]).default("bkash"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before topping up your wallet." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { amount, provider } = parsed.data;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (provider === "paypal") {
    try {
      const { data: rateRow } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "bdt_per_usd")
        .maybeSingle();
      const rate = Number(rateRow?.value ?? 125);
      const bdtPerUsd = Number.isFinite(rate) && rate > 0 ? rate : 125;
      const usdAmount = Number((amount / bdtPerUsd).toFixed(2));

      const payment = await createPaypalOrder({
        amount: usdAmount,
        reference: `wallet-${user.id}-${Date.now()}`,
        returnUrl: `${siteUrl}/api/webhooks/paypal?kind=wallet_topup&user_id=${user.id}&amount=${amount}`,
        cancelUrl: `${siteUrl}/dashboard/billing?wallet=cancelled`,
      });

      await supabase.from("payments").insert({
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
      amount,
      orderId: `wallet-${user.id}-${Date.now()}`,
      callbackURL: `${siteUrl}/api/webhooks/bkash?kind=wallet_topup&user_id=${user.id}&amount=${amount}`,
    });

    // Record the pending payment so the webhook can look it up by provider_txn_id.
    await supabase.from("payments").insert({
      payer_id: user.id,
      provider: "bkash",
      provider_txn_id: payment.paymentID,
      amount,
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
