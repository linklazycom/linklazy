import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { AdminOrderActions } from "@/components/orders/admin-order-actions";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, sites!orders_site_id_fkey(domain), buyer:buyer_id(id, full_name, email), seller:seller_id(id, full_name, email)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const site = order.sites as unknown as { domain: string } | null;
  const buyer = order.buyer as unknown as { id: string; full_name: string | null; email: string } | null;
  const seller = order.seller as unknown as { id: string; full_name: string | null; email: string } | null;

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, status")
    .eq("order_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">{site?.domain ?? "Order"}</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <MetricChip label="Status" value={order.status} tone={order.status === "accepted" ? "verified" : "price"} />
        <MetricChip label="Type" value={order.order_type} />
        {order.price_amount != null && <MetricChip label="Price" value={order.price_amount} tone="price" />}
      </div>
      <div className="mb-6">
        <OrderTimeline status={order.status} role="admin" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={buyer?.id ? `/profile/${buyer.id}` : "#"}
          className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand-violet hover:underline"
        >
          <span className="opacity-70">Buyer</span> {buyer?.full_name || buyer?.email || "—"}
        </Link>
        <span className="text-muted">purchased from</span>
        <Link
          href={seller?.id ? `/profile/${seller.id}` : "#"}
          className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2.5 py-1 font-medium text-signal hover:underline"
        >
          <span className="opacity-70">Seller</span> {seller?.full_name || seller?.email || "—"}
        </Link>
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
        <p>
          <span className="text-muted">Target: </span>
          <a href={order.target_url} target="_blank" rel="noreferrer" className="underline">
            {order.target_url}
          </a>{" "}
          ({order.anchor_text})
        </p>
        {order.proof_url && (
          <p className="mt-1">
            <span className="text-muted">Proof: </span>
            <a href={order.proof_url} target="_blank" rel="noreferrer" className="underline">
              {order.proof_url}
            </a>
          </p>
        )}
        {order.deadline_at && (
          <p className="mt-1">
            <span className="text-muted">Deadline: </span>
            {new Date(order.deadline_at).toLocaleString()}
          </p>
        )}
      </div>

      {dispute && (
        <Link href={`/admin/disputes/${dispute.id}`}>
          <Button variant="secondary">
            View dispute ({dispute.status})
          </Button>
        </Link>
      )}

      <AdminOrderActions orderId={order.id} status={order.status} />
    </div>
  );
}
