import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daily job: pay-per-view seller earnings sit as "pending" on site_unlocks
 * for a hold window (admin_settings.ppv_earning_hold_days, default 4 days)
 * before being credited to the seller's wallet. This releases anything
 * past that window that hasn't been reversed by an admin in the meantime.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("site_unlocks")
    .select("id, site_id, seller_earning, buyer_id, sites!inner(owner_id)")
    .eq("earning_status", "pending")
    .lte("earning_release_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let released = 0;

  for (const unlock of due ?? []) {
    const sellerId = (unlock as unknown as { sites: { owner_id: string } }).sites.owner_id;

    const { data: seller } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", sellerId)
      .single();

    const newBalance = (seller?.wallet_balance ?? 0) + unlock.seller_earning;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", sellerId);

    if (updateError) continue;

    await supabase.from("wallet_ledger").insert({
      user_id: sellerId,
      type: "seller_earning",
      amount: unlock.seller_earning,
      related_site_id: unlock.site_id,
      related_user_id: unlock.buyer_id,
      balance_after: newBalance,
      notes: "Pay-per-view earning released after hold period",
    });

    await supabase
      .from("site_unlocks")
      .update({ earning_status: "released" })
      .eq("id", unlock.id);

    released += 1;
  }

  return NextResponse.json({ ok: true, released });
}
