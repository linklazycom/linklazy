import type { SupabaseClient } from "@supabase/supabase-js";
import { grantDepositBonus } from "@/lib/deposit-bonus-server";

/**
 * The two "payment is confirmed" steps, shared by the browser-return callback
 * (app/api/webhooks/paypal) and the backup webhook (app/api/webhooks/paypal/events).
 * Both are idempotent: a status gate (initiated -> ...) lets only the first caller act.
 * Use the SERVICE-ROLE client. The caller has already verified the PayPal money.
 */
export interface PaymentToFinish {
  id: string;
  payer_id: string | null;
  credit_amount_bdt: number | null;
}

/** Order payment: initiated -> held_escrow, then the order moves on. Safe to call twice. */
export async function finishOrderPayment(supabase: SupabaseClient, pay: { id: string }, orderId: string) {
  await supabase.from("payments").update({ status: "held_escrow" }).eq("id", pay.id).eq("status", "initiated");
  await supabase.from("orders").update({ status: "pending_seller_acceptance" }).eq("id", orderId).eq("status", "pending_payment");
}

/**
 * Wallet top-up: initiated -> released (one-time gate), then credit the wallet, then the deposit bonus.
 *  credited = this call credited the wallet; already = someone else already did; failed = the credit failed
 *  and the payment was re-opened so the same callback (or the backup webhook) can retry without a second capture.
 */
export async function finishWalletTopup(
  supabase: SupabaseClient,
  pay: PaymentToFinish,
  paypalOrderId: string
): Promise<"credited" | "already" | "failed"> {
  if (!pay.payer_id || !pay.credit_amount_bdt) return "failed";
  const amount = Number(pay.credit_amount_bdt);

  const { data: claimed } = await supabase
    .from("payments")
    .update({ status: "released" })
    .eq("id", pay.id)
    .eq("status", "initiated")
    .select("id");
  if (!claimed || claimed.length === 0) return "already";

  const { error: creditError } = await supabase.rpc("adjust_wallet_balance", {
    p_user_id: pay.payer_id,
    p_delta: amount,
    p_type: "topup",
    p_notes: "Wallet top-up via PayPal",
    p_provider: "paypal",
    p_provider_txn_id: paypalOrderId,
  });
  if (creditError) {
    await supabase.from("payments").update({ status: "initiated" }).eq("id", pay.id);
    return "failed";
  }

  // Best effort: a bonus problem must never undo or hide the top-up.
  await grantDepositBonus(supabase, { userId: pay.payer_id, paymentId: pay.id, amount, provider: "paypal" });
  return "credited";
}
