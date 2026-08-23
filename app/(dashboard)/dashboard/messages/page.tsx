import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function MessagesInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // All orders the user is a party to, that have at least one message.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, buyer_id, seller_id, sites!orders_site_id_fkey(domain)"
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);

  const { data: lastMessages } = orderIds.length
    ? await supabase
        .from("messages")
        .select("order_id, body, sender_id, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: unreadNotifs } = await supabase
    .from("notifications")
    .select("link, read")
    .eq("user_id", user.id)
    .eq("type", "message")
    .eq("read", false);

  const unreadOrderIds = new Set(
    (unreadNotifs ?? []).map((n) => n.link?.split("/").pop()).filter(Boolean)
  );

  // Reduce to one (the most recent) message per order.
  const lastByOrder = new Map<string, { body: string; sender_id: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastByOrder.has(m.order_id)) {
      lastByOrder.set(m.order_id, m);
    }
  }

  const conversations = (orders ?? []).filter((o) => lastByOrder.has(o.id));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Messages</h1>

      {!conversations.length && (
        <p className="text-muted">
          No conversations yet — messages tied to an order will show up here.
        </p>
      )}

      <div className="space-y-3">
        {conversations.map((o) => {
          const last = lastByOrder.get(o.id)!;
          const isUnread = unreadOrderIds.has(o.id);
          const domain = Array.isArray(o.sites) ? o.sites[0]?.domain : (o.sites as { domain: string } | null)?.domain;

          return (
            <Link
              key={o.id}
              href={`/dashboard/orders/${o.id}`}
              className={`block rounded-chip border p-4 hover:border-brand-violet ${
                isUnread ? "border-brand-violet/40 bg-brand-soft" : "border-line bg-white"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{domain ?? "Order conversation"}</span>
                <div className="flex items-center gap-2">
                  {isUnread && <span className="h-2 w-2 rounded-full bg-brand-violet" />}
                  <MetricChip label="Order" value={o.status} />
                </div>
              </div>
              <p className="truncate text-sm text-muted">{last.body}</p>
              <p className="mt-1 text-[11px] text-muted">
                {new Date(last.created_at).toLocaleString()}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
