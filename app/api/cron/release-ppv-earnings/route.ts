import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

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

    // Claim this unlock first: flip earning_status away from "pending" only
    // if it's still "pending" right now. Vercel cron can retry an
    // invocation that timed out while a previous run is still in flight, or
    // this can overlap with an admin reversing the same unlock — the
    // status flip is what prevents the same row from being credited twice.
    const { data: claimed } = await supabase
      .from("site_unlocks")
      .update({ earning_status: "released" })
      .eq("id", unlock.id)
      .eq("earning_status", "pending")
      .select("id");

    if (!claimed || claimed.length === 0) continue;

    // Atomic credit: a single UPDATE ... SET balance = balance + amount, so
    // this can't be lost against a concurrent balance change elsewhere
    // (see adjust_wallet_balance in sql/001_atomic_wallet_adjust.sql).
    const { error: creditError } = await supabase.rpc("adjust_wallet_balance", {
      p_user_id: sellerId,
      p_delta: unlock.seller_earning,
      p_type: "seller_earning",
      p_related_site_id: unlock.site_id,
      p_related_user_id: unlock.buyer_id,
      p_notes: "Pay-per-view earning released after hold period",
    });

    if (creditError) {
      // Credit failed after we claimed it — put it back to "pending" so
      // tomorrow's run picks it up again instead of silently losing it.
      await supabase
        .from("site_unlocks")
        .update({ earning_status: "pending" })
        .eq("id", unlock.id);
      continue;
    }

    released += 1;
  }

  return NextResponse.json({ ok: true, released });
}
