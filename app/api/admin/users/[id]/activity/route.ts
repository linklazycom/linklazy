import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pulls together everything one user has done on the platform, for the
 * admin user-detail page: listed sites, orders as buyer/seller, disputes
 * they raised, wallet ledger entries, withdrawal requests, and support
 * tickets. Each list is capped and newest-first — this is an investigation
 * view, not a paginated export, so "last 50 of each" is enough to spot
 * patterns without loading someone's entire history.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }
  const { supabase } = check;
  const { id: userId } = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, is_suspended, is_flagged, flag_reason, is_banned, banned_reason, seller_tier, buyer_plan, buyer_views_quota, buyer_views_used, buyer_plan_renews_at, seller_plan, wallet_balance, created_at"
    )
    .eq("id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Email lives on auth.users — needs the service client.
  const serviceClient = createServiceClient();
  const { data: authUser } = await serviceClient.auth.admin.getUserById(userId);

  const [sites, buyerOrders, sellerOrders, disputes, walletLedger, withdrawals, supportTickets] =
    await Promise.all([
      supabase
        .from("sites")
        .select("id, domain, niche, status, da, dr, dr_verified, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select("id, site_id, status, order_type, price_amount, created_at, sites!orders_site_id_fkey(domain)")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select("id, site_id, status, order_type, price_amount, created_at, sites!orders_site_id_fkey(domain)")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("disputes")
        .select("id, order_id, status, reason, created_at")
        .eq("raised_by", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("wallet_ledger")
        .select("id, type, amount, balance_after, notes, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("withdrawal_requests")
        .select("id, amount, status, bkash_number, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("support_tickets")
        .select("id, subject, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return NextResponse.json({
    profile: { ...profile, email: authUser?.user?.email ?? null },
    sites: sites.data ?? [],
    buyerOrders: buyerOrders.data ?? [],
    sellerOrders: sellerOrders.data ?? [],
    disputes: disputes.data ?? [],
    walletLedger: walletLedger.data ?? [],
    withdrawals: withdrawals.data ?? [],
    supportTickets: supportTickets.data ?? [],
  });
}
