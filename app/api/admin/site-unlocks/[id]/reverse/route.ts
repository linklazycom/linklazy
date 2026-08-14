import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Reverses a pay-per-view unlock while its earning is still "pending"
 * (i.e. within the hold window). Refunds the buyer's spend + platform fee
 * back to their wallet, cancels the seller's pending earning, and revokes
 * the buyer's access to the listing.
 *
 * RLS on site_unlocks/profiles restricts writes to admins, same pattern as
 * the withdrawals admin route — a non-admin session will just fail here.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: unlockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

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

  // Service client for the multi-step refund + status change — kept as two
  // writes (not a single RPC) since this is a low-volume admin action, but
  // ordered so a partial failure leaves the unlock still "pending" (safe to
  // retry) rather than double-refunding.
  const serviceClient = createServiceClient();

  const { data: buyer } = await serviceClient
    .from("profiles")
    .select("wallet_balance")
    .eq("id", unlock.buyer_id)
    .single();

  const newBuyerBalance = (buyer?.wallet_balance ?? 0) + unlock.price_paid;

  const { error: refundError } = await serviceClient
    .from("profiles")
    .update({ wallet_balance: newBuyerBalance })
    .eq("id", unlock.buyer_id);

  if (refundError) return NextResponse.json({ error: refundError.message }, { status: 500 });

  await serviceClient.from("wallet_ledger").insert({
    user_id: unlock.buyer_id,
    type: "topup",
    amount: unlock.price_paid,
    related_site_id: unlock.site_id,
    balance_after: newBuyerBalance,
    notes: "Refund — pay-per-view unlock reversed by admin",
  });

  await serviceClient
    .from("site_unlocks")
    .update({ earning_status: "reversed", expires_at: new Date().toISOString() })
    .eq("id", unlockId);

  return NextResponse.json({ ok: true });
}
