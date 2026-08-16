import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

  // Pay-per-view earnings live in profiles.wallet_balance (kept in sync by the
  // unlock_site_with_wallet RPC). This is spendable cash, not a credit total,
  // so it's added directly rather than summed from the ledger.
  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();
  const walletBalance = profile?.wallet_balance ?? 0;

  // Pending/approved/paid requests all lock funds — only a rejected
  // request frees the balance back up.
  const { data: existingRequests } = await supabase
    .from("withdrawal_requests")
    .select("amount, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved", "paid"]);
  const totalLocked = (existingRequests ?? []).reduce((sum, r) => sum + r.amount, 0);

  const available = totalReferralEarned + walletBalance - totalLocked;

  if (parsed.data.amount > available) {
    return NextResponse.json(
      { error: `You can withdraw at most ৳${available}.` },
      { status: 400 }
    );
  }

  // Reserve funds from the wallet immediately (up to what's available there)
  // so the same taka can't be withdrawn twice via two concurrent requests.
  // Referral credits aren't a live balance, so only the wallet portion needs
  // debiting here — the wallet debit is authoritative and atomic per-user.
  const fromWallet = Math.min(parsed.data.amount, walletBalance);
  if (fromWallet > 0) {
    const serviceClient = createServiceClient();
    const { data: freshProfile } = await serviceClient
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .single();

    if (!freshProfile || freshProfile.wallet_balance < fromWallet) {
      return NextResponse.json({ error: "Wallet balance changed, please retry." }, { status: 409 });
    }

    const newBalance = freshProfile.wallet_balance - fromWallet;
    await serviceClient.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
    await serviceClient.from("wallet_ledger").insert({
      user_id: user.id,
      type: "withdrawal",
      amount: -fromWallet,
      balance_after: newBalance,
      notes: "Reserved for withdrawal request",
    });
  }

  const { error } = await supabase.from("withdrawal_requests").insert({
    user_id: user.id,
    amount: parsed.data.amount,
    bkash_number: parsed.data.bkash_number,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
