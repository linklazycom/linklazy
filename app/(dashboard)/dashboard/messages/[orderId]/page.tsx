import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { ChatWindow } from "@/components/orders/chat-window";

export default async function OrderMessagesPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, buyer_id, seller_id, target_url, sites!orders_site_id_fkey(domain)")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    notFound();
  }

  const domain = Array.isArray(order.sites) ? order.sites[0]?.domain : (order.sites as { domain: string } | null)?.domain;

  return (
    <div className="max-w-2xl">
      <Link href={`/dashboard/orders/${order.id}`} className="mb-4 inline-block text-sm text-muted underline">
        ← Back to order
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-medium">{domain ?? "Order"} — messages</h1>
          <p className="mt-1 truncate text-xs text-muted">{order.target_url}</p>
        </div>
        <MetricChip label="Status" value={order.status} tone={order.status === "accepted" ? "verified" : "price"} />
      </div>

      <ChatWindow orderId={order.id} userId={user.id} />
    </div>
  );
}
