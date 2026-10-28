import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { PressReleaseCatalogAdmin } from "@/components/press-releases/press-release-catalog-admin";
import { PRESS_STATUSES, PRESS_STATUS_LABEL, isOpenPress, isOverdue, marginOf } from "@/lib/press-release-flow";

export default async function AdminPressReleasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: filter = "open" } = await searchParams;
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("press_release_orders")
    .select("id, headline, website_url, status, total_amount, created_at, expected_delivery_at, profiles:user_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (orders ?? []).map((o) => o.id);
  const { data: fulfillment } = ids.length
    ? await supabase.from("press_release_fulfillment").select("order_id, supplier_name, supplier_cost").in("order_id", ids)
    : { data: [] as { order_id: string; supplier_name: string | null; supplier_cost: number | null }[] };
  const byOrder = new Map((fulfillment ?? []).map((f) => [f.order_id as string, f]));

  const now = new Date();
  const all = orders ?? [];
  const shown = all.filter((o) => (filter === "open" ? isOpenPress(o.status) : filter === "all" ? true : o.status === filter));
  const overdueCount = all.filter((o) => isOverdue(o, now)).length;
  const tabs = [{ key: "open", label: `Open (${all.filter((o) => isOpenPress(o.status)).length})` }, ...PRESS_STATUSES.map((s) => ({ key: s, label: `${PRESS_STATUS_LABEL[s]} (${all.filter((o) => o.status === s).length})` })), { key: "all", label: "All" }];

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-medium">Press release queue</h1>
        <p className="mt-1 text-sm text-muted">
          Review incoming requests, track suppliers and margin, and keep clients updated.
          {overdueCount > 0 && <span className="ml-2 font-medium text-red-600">{overdueCount} overdue</span>}
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {tabs.map((t) => (
          <Link key={t.key} href={`/admin/press-releases?status=${t.key}`} className={`rounded-chip border px-3 py-1 ${filter === t.key ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((order) => {
          const client = order.profiles as unknown as { full_name: string | null } | null;
          const f = byOrder.get(order.id);
          const margin = marginOf(Number(order.total_amount), f?.supplier_cost);
          const overdue = isOverdue(order, now);
          return (
            <Link key={order.id} href={`/admin/press-releases/${order.id}`} className="block rounded-chip border border-line bg-white p-4 hover:border-ink">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{order.headline}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {client?.full_name ?? "Client"} · {new Date(order.created_at).toLocaleDateString()}
                    {f?.supplier_name ? ` · Supplier: ${f.supplier_name}` : ""}
                  </p>
                </div>
                <MetricChip label="Status" value={order.status.replaceAll("_", " ")} tone={order.status === "published" ? "verified" : "price"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <MetricChip label="Total" value={`৳${Number(order.total_amount).toLocaleString()}`} tone="price" />
                {margin && <MetricChip label="Margin" value={`৳${margin.margin.toLocaleString()} (${margin.percent}%)`} />}
                {order.expected_delivery_at && isOpenPress(order.status) && (
                  <MetricChip label={overdue ? "OVERDUE" : "Due"} value={new Date(order.expected_delivery_at).toISOString().slice(0, 10)} tone={overdue ? "price" : "default"} />
                )}
              </div>
            </Link>
          );
        })}
        {!shown.length && <p className="text-muted">No requests here.</p>}
      </div>
      <PressReleaseCatalogAdmin />
    </div>
  );
}
