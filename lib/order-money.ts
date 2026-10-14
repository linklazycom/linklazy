import type { SupabaseClient } from "@supabase/supabase-js";
import { commissionRateForCumulativeUsd, startOfCurrentMonthISO } from "@/lib/commission";
import { getBdtPerUsd } from "@/lib/exchange-rate";
import { creditWalletRefund } from "@/lib/wallet-refund";

/**
 * The ONLY place that moves escrowed order money. The buyer-accept route, the
 * admin "force accept / cancel / refund" actions and the dispute resolution all
 * go through these two functions, so they can no longer drift apart (before,
 * admin "force accept" marked an order accepted but never paid the seller).
 *
 * Always call them with the SERVICE-ROLE client, and only after the caller has
 * atomically "claimed" the status change (so two requests can't both pay).
 */

export interface MoneyOrder {
  id: string;
  order_type: string;
  price_amount: number | null;
  buyer_id: string;
  seller_id: string;
  site_id: string;
}

export type MoneyResult = { ok: true; manualProviderRefund?: boolean } | { ok: false; error: string };

/**
 * Pure commission maths (no database): the tier is picked from the seller's
 * month-to-date total in USD INCLUDING this order. All stored amounts are BDT,
 * so they are converted with the live rate before the USD thresholds apply.
 */
export function computeCommission(priorMonthTotalBdt: number, orderAmountBdt: number, bdtPerUsd: number) {
  const cumulativeBdt = priorMonthTotalBdt + orderAmountBdt;
  const rate = commissionRateForCumulativeUsd(cumulativeBdt / bdtPerUsd);
  const commissionAmount = Math.round((orderAmountBdt * rate) / 100);
  return { rate, commissionAmount, sellerEarning: orderAmountBdt - commissionAmount };
}

/** Pays the seller (price minus tiered commission) out of the held escrow. */
export async function releaseOrderToSeller(
  service: SupabaseClient,
  order: MoneyOrder,
  noteSuffix = ""
): Promise<MoneyResult> {
  if (order.order_type !== "paid" || !order.price_amount) return { ok: true };

  const { data: held } = await service
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("status", "held_escrow");
  if (!held || held.length === 0) {
    return { ok: false, error: "No held payment found for this order." };
  }

  // Commission is tiered on the seller's cumulative sales this calendar month
  // (see lib/commission.ts); this order is excluded from the "prior" sum.
  const { data: priorOrders } = await service
    .from("orders")
    .select("price_amount")
    .eq("seller_id", order.seller_id)
    .eq("order_type", "paid")
    .eq("status", "accepted")
    .gte("accepted_at", startOfCurrentMonthISO())
    .neq("id", order.id);

  const priorMonthTotal = (priorOrders ?? []).reduce((sum, o) => sum + (o.price_amount ?? 0), 0);
  const bdtPerUsd = await getBdtPerUsd(service);
  const {
    rate: commissionRate,
    commissionAmount,
    sellerEarning,
  } = computeCommission(priorMonthTotal, order.price_amount, bdtPerUsd);

  // Pay first: if this fails nothing has changed and the caller can undo its claim.
  const { error: creditError } = await service.rpc("adjust_wallet_balance", {
    p_user_id: order.seller_id,
    p_delta: sellerEarning,
    p_type: "seller_earning",
    p_related_site_id: order.site_id,
    p_related_user_id: order.buyer_id,
    p_notes: `Order payout after ${commissionRate}% commission${noteSuffix}`,
  });
  if (creditError) return { ok: false, error: creditError.message };

  await service
    .from("orders")
    .update({ commission_rate: commissionRate, commission_amount: commissionAmount })
    .eq("id", order.id);

  await service
    .from("payments")
    .update({ status: "released" })
    .eq("order_id", order.id)
    .eq("status", "held_escrow");

  return { ok: true };
}

/**
 * Gives the buyer's escrowed money back.
 *  - wallet payments: credited back to the buyer's wallet right here
 *  - bKash / PayPal payments: marked "refunded" only; the money must be returned
 *    through the provider by an admin (manualProviderRefund = true tells the caller)
 */
export async function refundOrderToBuyer(
  service: SupabaseClient,
  order: MoneyOrder,
  reason: string
): Promise<MoneyResult> {
  if (order.order_type !== "paid" || !order.price_amount) return { ok: true };

  const { data: claimed, error } = await service
    .from("payments")
    .update({ status: "refunded" })
    .eq("order_id", order.id)
    .eq("status", "held_escrow")
    .select("id, provider, amount");
  if (error) return { ok: false, error: error.message };
  if (!claimed || claimed.length === 0) return { ok: true }; // nothing held (e.g. already refunded)

  const walletRows = claimed.filter((p) => p.provider === "wallet");
  const walletAmount = walletRows.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  if (walletAmount > 0) {
    const { error: creditError } = await creditWalletRefund(service, {
      userId: order.buyer_id,
      amount: walletAmount,
      relatedSiteId: order.site_id,
      notes: `Refund - ${reason}`,
    });
    if (creditError) {
      // Undo the claim so the refund can be retried.
      await service
        .from("payments")
        .update({ status: "held_escrow" })
        .in("id", claimed.map((p) => p.id));
      return { ok: false, error: creditError.message };
    }
  }

  return { ok: true, manualProviderRefund: claimed.some((p) => p.provider !== "wallet") };
}
