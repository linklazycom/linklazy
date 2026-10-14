import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REFUND_LEDGER_TYPE } from "@/lib/ledger-types";
import { planWithdrawal, referralAvailable, type LockedRequest } from "@/lib/withdrawal-flow";

const requestSchema = z.object({
  amount: z.number().int().positive(),
  bkash_number: z.string().trim().min(11).max(14),
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

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

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
  const walletBalance = profile?.wallet_balance ?? 0;

  const service = createServiceClient();
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
      await service.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_delta: plan.fromWallet,
        p_type: REFUND_LEDGER_TYPE,
        p_notes: why,
      });
    }
  };

  // SECURITY: inserted server-side (no client insert policy). wallet_reserved
  // remembers how much came out of the wallet so a rejection can give it back.
  const { data: created, error } = await service
    .from("withdrawal_requests")
    .insert({
      user_id: user.id,
      amount: parsed.data.amount,
      bkash_number: parsed.data.bkash_number,
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
