import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminPressReleasesPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase.from("press_release_orders").select("id, headline, website_url, status, total_amount, created_at, profiles:user_id(full_name)").order("created_at", { ascending: false }).limit(100);
  return <div><div className="mb-6"><h1 className="font-display text-2xl font-medium">Press release queue</h1><p className="mt-1 text-sm text-muted">Review incoming requests and keep clients updated.</p></div><div className="space-y-3">{orders?.map((order) => { const client = order.profiles as unknown as { full_name: string | null } | null; return <Link key={order.id} href={`/admin/press-releases/${order.id}`} className="block rounded-chip border border-line bg-white p-4 hover:border-ink"><div className="flex items-start justify-between gap-4"><div><h2 className="font-medium">{order.headline}</h2><p className="mt-1 text-sm text-muted">{client?.full_name ?? "Client"} · {new Date(order.created_at).toLocaleDateString()}</p></div><MetricChip label="Status" value={order.status.replaceAll("_", " ")} tone={order.status === "published" ? "verified" : "price"} /></div><div className="mt-3 flex gap-2"><MetricChip label="Total" value={`৳${Number(order.total_amount).toLocaleString()}`} tone="price" /></div></Link>; })}{!orders?.length && <p className="text-muted">No press release requests yet.</p>}</div></div>;
}
