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

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending_payment,pending_seller_acceptance,awaiting_seller_site,in_progress,delivered", label: "Active" },
  { value: "pending_seller_acceptance", label: "Awaiting seller" },
  { value: "disputed", label: "Disputed" },
  { value: "accepted", label: "Accepted" },
  { value: "cancelled,refunded", label: "Cancelled/Refunded" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_type, status, price_amount, anchor_text, created_at, buyer:buyer_id(id, full_name, email), seller:seller_id(id, full_name, email), sites!orders_site_id_fkey(domain)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.in("status", status.split(","));
  }

  const { data: orders } = await query;

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-medium">Orders</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/orders?status=${f.value}` : "/admin/orders"}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              (status ?? "") === f.value
                ? "border-ink bg-ink text-white"
                : "border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {orders?.map((order) => {
          const site = order.sites as unknown as { domain: string } | null;
          const buyer = order.buyer as unknown as { id: string; full_name: string | null; email: string } | null;
          const seller = order.seller as unknown as { id: string; full_name: string | null; email: string } | null;
          return (
            <div key={order.id} className="rounded-chip border border-line bg-white p-4 hover:border-ink">
              <Link href={`/admin/orders/${order.id}`} className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{site?.domain ?? "Site"}</span>
                <MetricChip label="Status" value={order.status} tone={STATUS_TONE[order.status] ?? "default"} />
              </Link>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={buyer?.id ? `/profile/${buyer.id}` : "#"}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1 font-medium text-brand-violet hover:underline"
                >
                  <span className="opacity-70">Buyer</span>
                  {buyer?.full_name || buyer?.email || "—"}
                </Link>
                <span className="text-muted">→</span>
                <Link
                  href={seller?.id ? `/profile/${seller.id}` : "#"}
                  className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2 py-1 font-medium text-signal hover:underline"
                >
                  <span className="opacity-70">Seller</span>
                  {seller?.full_name || seller?.email || "—"}
                </Link>
              </div>
              <Link href={`/admin/orders/${order.id}`} className="mb-3 block">
                <OrderProgress status={order.status} />
              </Link>
              <Link href={`/admin/orders/${order.id}`} className="flex flex-wrap gap-2">
                <MetricChip label="Type" value={order.order_type} />
                {order.price_amount != null && (
                  <MetricChip label="Price" value={order.price_amount} tone="price" />
                )}
                <MetricChip label="Anchor" value={order.anchor_text} />
                <span className="text-xs text-muted">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </Link>
            </div>
          );
        })}
        {!orders?.length && <p className="text-muted">No orders found.</p>}
      </div>
    </div>
  );
}
