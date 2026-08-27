import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { OrderProgress } from "@/components/orders/order-progress";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  accepted: "verified",
  delivered: "price",
  in_progress: "price",
  pending_seller_acceptance: "price",
  awaiting_seller_site: "price",
  pending_payment: "price",
  disputed: "default",
  cancelled: "default",
  refunded: "default",
};

const ACTIVE_STATUSES = ["pending_payment", "pending_seller_acceptance", "awaiting_seller_site", "in_progress", "delivered", "disputed"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role: roleParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const canSell = profile?.role === "seller" || profile?.role === "both" || profile?.role === "admin";
  const canBuy = profile?.role === "buyer" || profile?.role === "both" || profile?.role === "admin";
  // Both tabs only make sense for a "both"/admin account — a pure buyer can
  // never receive orders (they can't list a site) and a pure seller has no
  // buying-side dashboard tools (see Marketplace nav), so for either of
  // those this page should just show their one side with no tab bar at all.
  const showTabs = canBuy && canSell;

  const { data: allOrders } = await supabase
    .from("orders")
    .select(
      "id, site_id, order_type, status, target_url, anchor_text, price_amount, buyer_id, seller_id, created_at, sites!orders_site_id_fkey(domain)"
    )
    .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  const buying = canBuy ? (allOrders ?? []).filter((o) => o.buyer_id === user!.id) : [];
  const selling = canSell ? (allOrders ?? []).filter((o) => o.seller_id === user!.id) : [];

  // Default to whichever side actually has orders — most users lean buyer
  // or seller, not both, so land them on the tab with something to see.
  const role =
    roleParam === "selling" && canSell
      ? "selling"
      : roleParam === "buying" && canBuy
        ? "buying"
        : canBuy && (buying.length > 0 || !canSell || selling.length === 0)
          ? "buying"
          : "selling";
  const orders = role === "buying" ? buying : selling;
  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Orders</h1>

      {showTabs && (
        <div className="mb-6 flex gap-2 border-b border-line">
          <Link
            href="/dashboard/orders?role=buying"
            className={`border-b-2 px-3 pb-3 text-sm font-medium ${
              role === "buying" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Orders I&apos;m buying <span className="text-xs text-muted">({buying.length})</span>
          </Link>
          <Link
            href="/dashboard/orders?role=selling"
            className={`border-b-2 px-3 pb-3 text-sm font-medium ${
              role === "selling" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Orders I&apos;m fulfilling <span className="text-xs text-muted">({selling.length})</span>
          </Link>
        </div>
      )}

      {orders.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          {activeCount} active, {orders.length - activeCount} completed or closed
        </p>
      )}

      {!orders.length && (
        <p className="text-muted">
          {role === "buying" ? "You haven't placed any orders yet." : "No one has ordered from you yet."}
        </p>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          // @ts-expect-error -- joined relation shape isn't in the placeholder Database type
          const domain = order.sites?.domain ?? "Site";
          const reorderHref =
            role === "buying"
              ? `/dashboard/browse/${order.site_id}?reorder_target=${encodeURIComponent(
                  order.target_url
                )}&reorder_anchor=${encodeURIComponent(order.anchor_text)}`
              : null;
          return (
            <div key={order.id} className="rounded-chip border border-line bg-white p-4">
              <Link href={`/dashboard/orders/${order.id}`} className="block hover:opacity-80">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{domain}</span>
                  <MetricChip label="Status" value={order.status} tone={STATUS_TONE[order.status] ?? "default"} />
                </div>
                <div className="mb-3">
                  <OrderProgress status={order.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricChip label="Type" value={order.order_type} />
                  {order.price_amount != null && (
                    <MetricChip label="Price" value={order.price_amount} tone="price" />
                  )}
                  <MetricChip label="Anchor" value={order.anchor_text} />
                </div>
              </Link>
              {reorderHref && (
                <Link
                  href={reorderHref}
                  className="mt-2 inline-block text-xs text-brand-blue underline"
                >
                  Reorder — same target &amp; anchor
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
