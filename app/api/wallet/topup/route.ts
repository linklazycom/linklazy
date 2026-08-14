import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createBkashPayment } from "@/lib/bkash/client";

const topupSchema = z.object({
  amount: z.coerce.number().int().min(50, "Minimum top-up is ৳50").max(50000, "Maximum top-up is ৳50,000"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { amount } = parsed.data;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
