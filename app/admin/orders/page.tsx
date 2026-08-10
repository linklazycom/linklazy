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

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_type, status, price_amount, anchor_text, created_at, sites(domain)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Orders</h1>
      <div className="space-y-3">
        {orders?.map((order) => {
          const site = order.sites as unknown as { domain: string } | null;
          return (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{site?.domain ?? "Site"}</span>
                <MetricChip label="Status" value={order.status} tone={STATUS_TONE[order.status] ?? "default"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Type" value={order.order_type} />
                {order.price_amount != null && (
                  <MetricChip label="Price" value={order.price_amount} tone="price" />
                )}
                <MetricChip label="Anchor" value={order.anchor_text} />
                <span className="text-xs text-muted">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          );
        })}
        {!orders?.length && <p className="text-muted">No orders yet.</p>}
      </div>
    </div>
  );
}
