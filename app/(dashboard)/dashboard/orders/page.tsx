import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  accepted: "verified",
  delivered: "price",
  in_progress: "price",
  awaiting_seller_site: "price",
  pending_payment: "price",
  disputed: "default",
  cancelled: "default",
  refunded: "default",
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, site_id, order_type, status, target_url, anchor_text, price_amount, buyer_id, seller_id, created_at, sites(domain)")
    .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Orders</h1>

      {!orders?.length && <p className="text-muted">No orders yet.</p>}

      <div className="space-y-3">
        {orders?.map((order) => {
          const role = order.buyer_id === user!.id ? "buyer" : "seller";
          // @ts-expect-error -- joined relation shape isn't in the placeholder Database type
          const domain = order.sites?.domain ?? "Site";
          const reorderHref =
            role === "buyer"
              ? `/dashboard/browse/${order.site_id}?reorder_target=${encodeURIComponent(
                  order.target_url
                )}&reorder_anchor=${encodeURIComponent(order.anchor_text)}`
              : null;
          return (
            <div key={order.id} className="rounded-chip border border-line bg-white p-4">
              <Link href={`/dashboard/orders/${order.id}`} className="block hover:opacity-80">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{domain}</span>
                  <MetricChip label="Status" value={order.status} tone={STATUS_TONE[order.status] ?? "default"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricChip label="Role" value={role} />
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
