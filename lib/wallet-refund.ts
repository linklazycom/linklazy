import type { SupabaseClient } from "@supabase/supabase-js";
import { REFUND_FALLBACK_LEDGER_TYPE, REFUND_LEDGER_TYPE } from "@/lib/ledger-types";

export interface RefundCredit {
  userId: string;
  amount: number;
  notes: string;
  relatedSiteId?: string;
}

/**
 * Credits money back to a wallet with the refund ledger type. adjust_wallet_balance
 * is atomic, so a failed call changes nothing and retrying once with the fallback
 * type is safe. Use the SERVICE-ROLE client.
 */
export async function creditWalletRefund(
  service: SupabaseClient,
  credit: RefundCredit
): Promise<{ error: { message: string } | null }> {
  const call = (type: string) =>
    service.rpc("adjust_wallet_balance", {
      p_user_id: credit.userId,
      p_delta: credit.amount,
      p_type: type,
      p_related_site_id: credit.relatedSiteId,
      p_notes: credit.notes,
    });

  const first = await call(REFUND_LEDGER_TYPE);
  if (!first.error) return { error: null };

  const second = await call(REFUND_FALLBACK_LEDGER_TYPE);
  return { error: second.error ? { message: second.error.message } : null };
}
