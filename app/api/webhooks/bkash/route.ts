import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeBkashPayment } from "@/lib/bkash/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentID = url.searchParams.get("paymentID");
  const orderId = url.searchParams.get("order_id");
  const status = url.searchParams.get("status"); // success | failure | cancel
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!paymentID || !orderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  const supabase = createServiceClient();

  if (status !== "success") {
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=cancelled`);
  }

  try {
    const result = await executeBkashPayment(paymentID);

    await supabase
      .from("payments")
      .update({
        status: "held_escrow",
        raw_response: result as unknown as Record<string, unknown>,
      })
      .eq("provider_txn_id", paymentID);

    await supabase
      .from("orders")
      .update({ status: "in_progress" })
      .eq("id", orderId)
      .eq("status", "pending_payment");

    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  } catch {
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }
}
