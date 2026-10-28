import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { creditWalletRefund } from "@/lib/wallet-refund";
import { planWithdrawal, referralAvailable, type LockedRequest } from "@/lib/withdrawal-flow";
import { validatePayout } from "@/lib/payout-methods";
import { lockedBonusOf } from "@/lib/deposit-bonus-server";
import { withdrawableWallet } from "@/lib/deposit-bonus";

// Payout details are checked by validatePayout (per method). "bkash_number" is
// still accepted as an alias so an old cached form keeps working.
const requestSchema = z.object({
  amount: z.number().int().positive(),
  method: z.string().max(20).optional(),
  account_number: z.string().max(60).optional(),
  account_name: z.string().max(120).optional(),
  bank_name: z.string().max(120).optional(),
  bank_branch: z.string().max(120).optional(),
  routing_number: z.string().max(20).optional(),
  bkash_number: z.string().max(30).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before requesting a withdrawal." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const payout = validatePayout({
    method: parsed.data.method ?? "bkash",
    account_number: parsed.data.account_number ?? parsed.data.bkash_number,
    account_name: parsed.data.account_name,
    bank_name: parsed.data.bank_name,
    bank_branch: parsed.data.bank_branch,
    routing_number: parsed.data.routing_number,
  });
  if (!payout.ok) return NextResponse.json({ error: payout.error }, { status: 400 });
  const details = payout.value;

  const { data: credits } = await supabase
    .from("referral_credits")
    .select("amount")
    .eq("referrer_id", user.id);
  const totalReferralEarned = (credits ?? []).reduce((sum, c) => sum + c.amount, 0);

  // Pay-per-view earnings and order payouts live in profiles.wallet_balance.
  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();
  const service = createServiceClient();
  // Deposit bonus can be spent on the platform but never withdrawn (Batch 19C).
  const walletBalance = withdrawableWallet(profile?.wallet_balance ?? 0, await lockedBonusOf(service, user.id));

  const loadRequests = async () => {
    const { data } = await service
      .from("withdrawal_requests")
      .select("amount, status, wallet_reserved")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved", "paid"]);
    return (data ?? []) as LockedRequest[];
  };

  const plan = planWithdrawal(
    parsed.data.amount,
    walletBalance,
    referralAvailable(totalReferralEarned, await loadRequests())
  );
  if (!plan.ok) {
    return NextResponse.json({ error: `You can withdraw at most \u09f3${plan.available}.` }, { status: 400 });
  }

  // Reserve the wallet part immediately through the atomic RPC (single UPDATE
  // ... WHERE wallet_balance + delta >= 0), so concurrent requests cannot spend
  // the same balance twice.
  if (plan.fromWallet > 0) {
    const { error: debitError } = await service.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_delta: -plan.fromWallet,
      p_type: "withdrawal",
      p_notes: "Reserved for withdrawal request",
    });
    if (debitError) {
      return NextResponse.json({ error: "Wallet balance changed, please retry." }, { status: 409 });
    }
  }

  const refundWallet = async (why: string) => {
    if (plan.fromWallet > 0) {
      await creditWalletRefund(service, { userId: user.id, amount: plan.fromWallet, notes: why });
    }
  };

  // SECURITY: inserted server-side (no client insert policy). wallet_reserved
  // remembers how much came out of the wallet so a rejection can give it back.
  const { data: created, error } = await service
    .from("withdrawal_requests")
    .insert({
      user_id: user.id,
      amount: parsed.data.amount,
      // bkash_number stays filled for bKash requests so older screens keep working.
      bkash_number: details.method === "bkash" ? details.account_number : null,
      method: details.method,
      account_number: details.account_number,
      account_name: details.account_name,
      bank_name: details.bank_name,
      bank_branch: details.bank_branch,
      routing_number: details.routing_number,
      wallet_reserved: plan.fromWallet,
    })
    .select("id")
    .single();

  if (error || !created) {
    await refundWallet("Withdrawal request could not be saved - reserved amount returned");
    return NextResponse.json({ error: error?.message ?? "Could not save the request" }, { status: 500 });
  }

  // Race guard for the referral part (it is not a live balance, so two requests
  // sent at the same moment could both pass the check above): re-check with
  // this request included and undo it if the referral credits are overdrawn.
  if (plan.fromReferral > 0) {
    const after = referralAvailable(totalReferralEarned, await loadRequests());
    if (after < 0) {
      await service.from("withdrawal_requests").delete().eq("id", created.id);
      await refundWallet("Withdrawal request cancelled (balance changed) - reserved amount returned");
      return NextResponse.json({ error: "Your balance changed, please retry." }, { status: 409 });
    }
  }

  return NextResponse.json({ ok: true });
}
