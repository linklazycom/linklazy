import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, buyer_plan, buyer_views_quota, buyer_views_used")
    .eq("id", user!.id)
    .single();

  const [
    { count: mySitesCount },
    { count: pendingSitesCount },
    { count: activeOrdersCount },
    { count: needsActionCount },
    { count: watchlistCount },
    { count: unreadDisputesCount },
  ] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("owner_id", user!.id),
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user!.id)
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .not("status", "in", "(accepted,cancelled,refunded)"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user!.id)
      .in("status", ["pending_seller_acceptance", "awaiting_seller_site", "in_progress"]),
    supabase.from("watchlists").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .eq("status", "disputed"),
  ]);

  const remaining = Math.max((profile?.buyer_views_quota ?? 0) - (profile?.buyer_views_used ?? 0), 0);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-medium">
        Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>
      <p className="mb-8 text-sm text-muted capitalize">{profile?.role ?? "buyer"} account</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="rounded-chip border border-line bg-white p-5">
          <p className="mb-1 text-xs text-muted">My sites</p>
          <p className="mb-3 font-display text-2xl font-medium">{mySitesCount ?? 0}</p>
          {!!pendingSitesCount && (
            <MetricChip label="Pending review" value={pendingSitesCount} tone="price" />
          )}
          <div className="mt-3">
            <Link href="/dashboard/sites" className="text-sm text-brand-violet underline">
              Manage sites
            </Link>
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <p className="mb-1 text-xs text-muted">Active orders</p>
          <p className="mb-3 font-display text-2xl font-medium">{activeOrdersCount ?? 0}</p>
          {!!needsActionCount && (
            <MetricChip label="Needs your delivery" value={needsActionCount} tone="price" />
          )}
          <div className="mt-3">
            <Link href="/dashboard/orders" className="text-sm text-brand-violet underline">
              View orders
            </Link>
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <p className="mb-1 text-xs text-muted">Buyer views left</p>
          <p className="mb-3 font-display text-2xl font-medium">
            {profile?.buyer_plan === "free" ? "—" : `${remaining}/${profile?.buyer_views_quota ?? 0}`}
          </p>
          <div className="mt-3">
            <Link href="/dashboard/billing" className="text-sm text-brand-violet underline">
              {profile?.buyer_plan === "free" ? "Upgrade plan" : "Manage plan"}
            </Link>
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <p className="mb-1 text-xs text-muted">Watchlist</p>
          <p className="mb-3 font-display text-2xl font-medium">{watchlistCount ?? 0}</p>
          <div className="mt-3">
            <Link href="/dashboard/watchlist" className="text-sm text-brand-violet underline">
              View watchlist
            </Link>
          </div>
        </div>

        {!!unreadDisputesCount && (
          <div className="rounded-chip border border-amber/40 bg-amber-soft p-5">
            <p className="mb-1 text-xs text-muted">Open disputes</p>
            <p className="mb-3 font-display text-2xl font-medium text-amber">{unreadDisputesCount}</p>
            <div className="mt-3">
              <Link href="/dashboard/orders" className="text-sm underline">
                Review orders
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-chip border border-dashed border-line bg-white p-5">
          <p className="mb-2 text-sm text-muted">Looking for links or exchanges?</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/browse">
              <Button size="sm" variant="secondary">
                Browse sites
              </Button>
            </Link>
            <Link href="/dashboard/sites/new">
              <Button size="sm">List a site</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
