import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import {
  BONUS_CLAWBACK_NOTE_PREFIX,
  BONUS_SETTING_KEYS,
  DEFAULT_BONUS,
  clawbackAmount,
  computeBonus,
  resolveBonusSettings,
  type BonusSettings,
} from "@/lib/deposit-bonus";

export async function getBonusSettings(client?: SupabaseClient): Promise<BonusSettings> {
  try {
    const { data } = await (client ?? createServiceClient()).from("site_settings").select("key, value").in("key", BONUS_SETTING_KEYS);
    return resolveBonusSettings(data);
  } catch {
    return DEFAULT_BONUS;
  }
}

/** Sum of the unspent (non-withdrawable) bonus of one user. Never throws; 0 if the table is missing. */
export async function lockedBonusOf(client: SupabaseClient, userId: string): Promise<number> {
  try {
    const { data } = await client.from("wallet_bonuses").select("remaining").eq("user_id", userId).eq("status", "granted");
    return (data ?? []).reduce((sum, r) => sum + Number(r.remaining ?? 0), 0);
  } catch {
    return 0;
  }
}

/** Credits the bonus to the wallet. 'bonus' ledger type first, 'admin_adjustment' if the database does not know it. */
async function creditBonus(service: SupabaseClient, userId: string, amount: number, notes: string) {
  const call = (type: string) =>
    service.rpc("adjust_wallet_balance", { p_user_id: userId, p_delta: amount, p_type: type, p_notes: notes });
  const first = await call("bonus");
  if (!first.error) return { error: null };
  return call("admin_adjustment");
}

/**
 * Grants the deposit bonus for one successful top-up. Safe to call twice for the same payment
 * (unique payment_id), never throws, and never affects the top-up itself (best effort).
 * Returns the bonus amount that was granted (0 if none / already granted / failed).
 */
export async function grantDepositBonus(
  service: SupabaseClient,
  input: { userId: string; paymentId: string; amount: number; provider: string }
): Promise<number> {
  try {
    const settings = await getBonusSettings(service);
    const bonus = computeBonus(input.amount, settings);
    if (bonus <= 0) return 0;

    // 1) claim the right to grant (unique payment_id), 2) credit, 3) mark granted.
    const { data: row, error: insertError } = await service
      .from("wallet_bonuses")
      .insert({
        user_id: input.userId,
        payment_id: input.paymentId,
        topup_amount: input.amount,
        bonus_amount: bonus,
        remaining: bonus,
        status: "pending",
        provider: input.provider,
      })
      .select("id")
      .single();
    if (insertError || !row) return 0; // already granted (duplicate) or table not ready

    const { error: creditError } = await creditBonus(service, input.userId, bonus, `Deposit bonus (${settings.percent}% of \u09f3${input.amount})`);
    if (creditError) {
      await service.from("wallet_bonuses").update({ status: "failed", remaining: 0 }).eq("id", row.id);
      return 0;
    }
    await service.from("wallet_bonuses").update({ status: "granted" }).eq("id", row.id);
    return bonus;
  } catch {
    return 0;
  }
}

/** Admin retry of a bonus whose wallet credit failed. */
export async function retryFailedBonus(service: SupabaseClient, bonusId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await service.from("wallet_bonuses").select("id, user_id, bonus_amount, status").eq("id", bonusId).maybeSingle();
  if (!row) return { ok: false, error: "Not found" };
  const { data: claimed } = await service.from("wallet_bonuses").update({ status: "pending", remaining: row.bonus_amount }).eq("id", bonusId).eq("status", "failed").select("id");
  if (!claimed || claimed.length === 0) return { ok: false, error: "Only a failed bonus can be retried." };
  const { error } = await creditBonus(service, row.user_id as string, Number(row.bonus_amount), "Deposit bonus (admin retry)");
  if (error) {
    await service.from("wallet_bonuses").update({ status: "failed", remaining: 0 }).eq("id", bonusId);
    return { ok: false, error: "The wallet could not be credited." };
  }
  await service.from("wallet_bonuses").update({ status: "granted" }).eq("id", bonusId);
  return { ok: true };
}

/**
 * Takes back the UNSPENT part of a bonus (use after refunding the deposit at the payment provider).
 * The bonus row is closed first (atomic claim), then the wallet is debited; if the debit fails the claim is undone.
 */
export async function clawBackBonus(service: SupabaseClient, bonusId: string): Promise<{ ok: boolean; clawed?: number; error?: string }> {
  const { data: row } = await service.from("wallet_bonuses").select("id, user_id, remaining, status").eq("id", bonusId).maybeSingle();
  if (!row) return { ok: false, error: "Not found" };
  if (row.status !== "granted") return { ok: false, error: "Only a granted bonus can be clawed back." };

  const { data: profile } = await service.from("profiles").select("wallet_balance").eq("id", row.user_id).maybeSingle();
  const take = clawbackAmount(Number(row.remaining), Number(profile?.wallet_balance ?? 0));

  const { data: claimed } = await service
    .from("wallet_bonuses")
    .update({ status: "clawed_back", remaining: 0, clawed_back_at: new Date().toISOString(), clawed_back_amount: take })
    .eq("id", bonusId)
    .eq("status", "granted")
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, error: "This bonus was just changed. Refresh and try again." };

  if (take > 0) {
    // The note prefix tells the database tracker not to use this debit to "spend" other bonuses.
    const { error } = await service.rpc("adjust_wallet_balance", {
      p_user_id: row.user_id,
      p_delta: -take,
      p_type: "admin_adjustment",
      p_notes: `${BONUS_CLAWBACK_NOTE_PREFIX} Deposit refunded - unspent bonus taken back`,
    });
    if (error) {
      await service.from("wallet_bonuses").update({ status: "granted", remaining: row.remaining, clawed_back_at: null, clawed_back_amount: null }).eq("id", bonusId);
      return { ok: false, error: "Could not debit the wallet. Nothing was changed." };
    }
  }
  return { ok: true, clawed: take };
}
