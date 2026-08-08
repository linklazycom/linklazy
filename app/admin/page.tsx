import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-medium">Overview</h1>
      <div className="flex gap-2">
        <MetricChip label="Pending sites" value={pendingCount ?? 0} tone="price" />
      </div>
    </div>
  );
}
