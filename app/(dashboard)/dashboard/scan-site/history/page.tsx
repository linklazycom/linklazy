import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  scanned: "verified",
  pending: "price",
  failed: "default",
};

const AUTO_ORDER_LABEL: Record<string, string> = {
  placed: "Auto-order: placed",
  partial: "Auto-order: partially placed",
  insufficient_balance: "Auto-order: insufficient balance",
  skipped: "Auto-order: skipped",
};

export default async function ScanHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: scans } = await supabase
    .from("buyer_site_scans")
    .select(
      "id, url, detected_niche, confidence, status, error_message, auto_order, auto_order_status, result_site_ids, created_at"
    )
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Your site scans</h1>
        <Link href="/dashboard/scan-site" className="text-sm text-brand-blue underline">
          + New scan
        </Link>
      </div>

      {!scans?.length && (
        <p className="text-sm text-muted">
          You haven&apos;t scanned a site yet.{" "}
          <Link href="/dashboard/scan-site" className="underline">
            Scan one now
          </Link>
          .
        </p>
      )}

      <div className="space-y-3">
        {scans?.map((s) => (
          <div key={s.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-medium">{s.url}</span>
              <MetricChip label="Status" value={s.status} tone={STATUS_TONE[s.status] ?? "default"} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {s.detected_niche && <span>Niche: {s.detected_niche}</span>}
              {s.confidence != null && <span>· {s.confidence}% confidence</span>}
              {s.result_site_ids?.length > 0 && (
                <span>· {s.result_site_ids.length} site(s) matched</span>
              )}
              <span>· {new Date(s.created_at).toLocaleDateString()}</span>
            </div>

            {s.status === "failed" && s.error_message && (
              <p className="mt-2 text-sm text-red-600">{s.error_message}</p>
            )}

            {s.auto_order && s.auto_order_status && (
              <p className="mt-2 text-sm">{AUTO_ORDER_LABEL[s.auto_order_status] ?? s.auto_order_status}</p>
            )}

            {s.status === "scanned" && s.result_site_ids?.length > 0 && (
              <Link
                href={`/dashboard/browse/bulk-order?ids=${s.result_site_ids.join(",")}`}
                className="mt-2 inline-block text-sm text-brand-blue underline"
              >
                View & order these {s.result_site_ids.length} site(s) →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
