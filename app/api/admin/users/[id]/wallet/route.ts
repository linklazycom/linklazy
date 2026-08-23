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
 * PPV earnings/refunds/goodwill credit). Goes through adjust_wallet_balance,
 * a single atomic Postgres UPDATE that also writes the wallet_ledger row in
 * the same transaction — so this can't race with, say, the PPV-release cron
 * or a withdrawal firing against the same profile at the same moment (the
 * old version read the balance, computed a new one, then wrote it back in
 * separate round trips, which a concurrent change could silently clobber).
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

  const { data, error: adjustError } = await serviceClient
    .rpc("adjust_wallet_balance", {
      p_user_id: targetId,
      p_delta: amount,
      p_type: "admin_adjustment",
      p_notes: notes || (amount > 0 ? "Manual credit by admin" : "Manual debit by admin"),
    })
    .single();

  if (adjustError) {
    if (amount < 0) {
      return NextResponse.json(
        { error: `Can't debit ৳${Math.abs(amount)} — user's wallet balance is lower than that (or the user wasn't found).` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const newBalance = (data as { new_balance: number }).new_balance;

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_wallet_adjusted",
    target_table: "profiles",
    target_id: targetId,
    metadata: { amount, notes: notes ?? null, balance_after: newBalance },
  });

  return NextResponse.json({ ok: true, balance: newBalance });
}
