import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Reverses a pay-per-view unlock while its earning is still "pending"
 * (i.e. within the hold window). Refunds the buyer's spend + platform fee
 * back to their wallet, cancels the seller's pending earning, and revokes
 * the buyer's access to the listing.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: unlockId } = await params;
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { supabase } = admin;

  const { data: unlock } = await supabase
    .from("site_unlocks")
    .select("id, buyer_id, site_id, price_paid, earning_status")
    .eq("id", unlockId)
    .single();

  if (!unlock) return NextResponse.json({ error: "Unlock not found." }, { status: 404 });

  if (unlock.earning_status !== "pending") {
    return NextResponse.json(
      { error: "Only pending (not yet released) earnings can be reversed. This one has already been released to the seller." },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Claim the reversal first: flip earning_status away from "pending" only
  // if it's still "pending" right now. If an admin double-clicks or two
  // reverse requests land at once, only the first one actually changes a
  // row here — the second gets rowCount 0 and bails before ever touching
  // the wallet, instead of both refunding the same unlock.
  const { data: claimed } = await serviceClient
    .from("site_unlocks")
    .update({ earning_status: "reversed", expires_at: new Date().toISOString() })
    .eq("id", unlockId)
    .eq("earning_status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "This unlock was already reversed or released by another request." },
      { status: 409 }
    );
  }

  // Atomic credit: a single UPDATE ... SET balance = balance + amount, so
  // this can't be lost against a concurrent balance change elsewhere (see
  // adjust_wallet_balance in sql/001_atomic_wallet_adjust.sql).
  const { error: refundError } = await serviceClient.rpc("adjust_wallet_balance", {
    p_user_id: unlock.buyer_id,
    p_delta: unlock.price_paid,
    p_type: "topup",
    p_related_site_id: unlock.site_id,
    p_notes: "Refund — pay-per-view unlock reversed by admin",
  });

  if (refundError) {
    // Wallet credit failed after we already claimed the reversal — put the
    // unlock back to "pending" so this is safe to retry instead of silently
    // losing the refund.
    await serviceClient
      .from("site_unlocks")
      .update({ earning_status: "pending", expires_at: null })
      .eq("id", unlockId);
    return NextResponse.json({ error: refundError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
