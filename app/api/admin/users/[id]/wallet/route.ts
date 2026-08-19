import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  // Positive to credit the wallet, negative to debit it. Zero is rejected —
  // there's nothing to log.
  amount: z.number().int().refine((n) => n !== 0, "Amount can't be zero."),
  notes: z.string().trim().max(280).optional(),
});

/**
 * Lets an admin manually adjust a user's spendable wallet balance (used for
 * PPV earnings/refunds/goodwill credit). Mirrors the debit path used by
 * withdrawals: update profiles.wallet_balance and insert a matching
 * wallet_ledger row atomically via the service-role client, so the ledger
 * always reconciles with the balance.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { amount, notes } = parsed.data;

  const serviceClient = createServiceClient();

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("wallet_balance")
    .eq("id", targetId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const currentBalance = profile.wallet_balance ?? 0;
  const newBalance = currentBalance + amount;

  if (newBalance < 0) {
    return NextResponse.json(
      { error: `Can't debit ৳${Math.abs(amount)} — wallet only has ৳${currentBalance}.` },
      { status: 400 }
    );
  }

  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", targetId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: ledgerError } = await serviceClient.from("wallet_ledger").insert({
    user_id: targetId,
    type: "admin_adjustment",
    amount,
    balance_after: newBalance,
    notes: notes || (amount > 0 ? "Manual credit by admin" : "Manual debit by admin"),
  });

  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_wallet_adjusted",
    target_table: "profiles",
    target_id: targetId,
    metadata: { amount, notes: notes ?? null, balance_after: newBalance },
  });

  return NextResponse.json({ ok: true, balance: newBalance });
}
