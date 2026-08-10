import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  open: "price",
  under_review: "price",
  resolved_buyer: "verified",
  resolved_seller: "verified",
  closed: "default",
};

export default async function AdminDisputesPage() {
  const supabase = await createClient();
  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, reason, status, created_at, orders(id, order_type, price_amount)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Disputes</h1>
      <div className="space-y-3">
        {disputes?.map((d) => {
          const order = d.orders as unknown as {
            id: string;
            order_type: string;
            price_amount: number | null;
          } | null;
          return (
            <Link
              key={d.id}
              href={`/admin/disputes/${d.id}`}
              className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">Order {order?.id.slice(0, 8)}</span>
                <MetricChip label="Status" value={d.status} tone={STATUS_TONE[d.status] ?? "default"} />
              </div>
              <p className="mb-2 text-sm text-ink line-clamp-2">{d.reason}</p>
              <div className="flex gap-2">
                {order?.order_type && <MetricChip label="Type" value={order.order_type} />}
                {order?.price_amount != null && (
                  <MetricChip label="Price" value={order.price_amount} tone="price" />
                )}
                <span className="text-xs text-muted">
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          );
        })}
        {!disputes?.length && <p className="text-muted">No disputes.</p>}
      </div>
    </div>
  );
}
