import { publicLimit } from "@/lib/public-limit";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyPaypalWebhook } from "@/lib/paypal/client";
import { captureCoversPayment, parseCaptureCompleted } from "@/lib/paypal/events";
import { finishOrderPayment, finishWalletTopup } from "@/lib/paypal/complete";

/**
 * Backup for the browser-return callback: if a buyer pays and then closes the tab, PayPal still
 * calls this URL with PAYMENT.CAPTURE.COMPLETED and the payment is finished the same way.
 *
 * Safety: nothing is processed unless PayPal itself confirms the call is genuine
 * (verify-webhook-signature with PAYPAL_WEBHOOK_ID). The payment row we wrote at initiation decides
 * who and how much; the event only proves that this PayPal order was really paid.
 * Always answers 200 for a genuine event that needs no action, so PayPal does not retry it forever.
 */
export async function POST(request: Request) {
  // Every call costs one PayPal verification request, so a flood from one address is cut off first.
  const limited = publicLimit(request, "paypal_events", 120);
  if (limited) return limited;
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return NextResponse.json({ error: "PayPal webhook is not configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const h = request.headers;
  const verified = await verifyPaypalWebhook(
    {
      authAlgo: h.get("paypal-auth-algo") ?? "",
      certUrl: h.get("paypal-cert-url") ?? "",
      transmissionId: h.get("paypal-transmission-id") ?? "",
      transmissionSig: h.get("paypal-transmission-sig") ?? "",
      transmissionTime: h.get("paypal-transmission-time") ?? "",
    },
    event
  );
  if (!verified) return NextResponse.json({ error: "Signature not verified" }, { status: 401 });

  const capture = parseCaptureCompleted(event);
  if (!capture) return NextResponse.json({ ok: true, ignored: true }); // another event type

  const supabase = createServiceClient();
  const { data: pay } = await supabase
    .from("payments")
    .select("id, status, amount, payer_id, order_id, credit_amount_bdt, raw_response")
    .eq("provider", "paypal")
    .eq("provider_txn_id", capture.paypalOrderId)
    .maybeSingle();
  if (!pay) return NextResponse.json({ ok: true, ignored: true }); // not one of ours

  if (pay.status !== "initiated") return NextResponse.json({ ok: true, alreadyDone: true });

  if (!captureCoversPayment(capture, Number(pay.amount))) {
    // Paid less than expected: leave it "initiated" for an admin to reconcile.
    return NextResponse.json({ ok: true, ignored: "amount_mismatch" });
  }

  try {
    await supabase
      .from("payments")
      .update({ raw_response: { ...((pay.raw_response as Record<string, unknown> | null) ?? {}), captured: true, status: "COMPLETED", via: "webhook" } })
      .eq("id", pay.id)
      .eq("status", "initiated");

    if (pay.order_id) {
      await finishOrderPayment(supabase, pay, pay.order_id as string);
      return NextResponse.json({ ok: true, kind: "order" });
    }
    const result = await finishWalletTopup(supabase, pay, capture.paypalOrderId);
    if (result === "failed") return NextResponse.json({ error: "Could not credit the wallet" }, { status: 500 }); // PayPal will retry
    return NextResponse.json({ ok: true, kind: "wallet_topup", result });
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // PayPal will retry
  }
}
