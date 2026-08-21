import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { SaveScanButton } from "@/components/dashboard/save-scan-button";

const MAX_UNSAVED_SCANS = 10;
const MAX_SAVED_SCANS = 10;

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

  const scanFields =
    "id, url, detected_niche, confidence, status, error_message, auto_order, auto_order_status, result_site_ids, is_saved, created_at";

  // Saved scans are pinned and never pruned — shown first, regardless of
  // age. Unsaved scans are capped at the latest 10 by the scan API's
  // auto-pruning, so this query just mirrors that same cap for display.
  const [{ data: saved }, { data: recent }] = await Promise.all([
    supabase
      .from("buyer_site_scans")
      .select(scanFields)
      .eq("buyer_id", user!.id)
      .eq("is_saved", true)
      .order("created_at", { ascending: false })
      .limit(MAX_SAVED_SCANS),
    supabase
      .from("buyer_site_scans")
      .select(scanFields)
      .eq("buyer_id", user!.id)
      .eq("is_saved", false)
      .order("created_at", { ascending: false })
      .limit(MAX_UNSAVED_SCANS),
  ]);

  const scans = [...(saved ?? []), ...(recent ?? [])];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Your site scans</h1>
        <Link href="/dashboard/scan-site" className="text-sm text-brand-blue underline">
          + New scan
        </Link>
      </div>
      <p className="mb-6 text-xs text-muted">
        History keeps your latest {MAX_UNSAVED_SCANS} scans automatically. Save up to{" "}
        {MAX_SAVED_SCANS} scans you want to keep longer — saved scans are pinned here and
        aren&apos;t removed when newer scans push older ones out.
      </p>

      {!scans.length && (
        <p className="text-sm text-muted">
          You haven&apos;t scanned a site yet.{" "}
          <Link href="/dashboard/scan-site" className="underline">
            Scan one now
          </Link>
          .
        </p>
      )}

      {saved && saved.length > 0 && (
        <p className="mb-2 text-xs font-medium text-muted">Saved ({saved.length}/{MAX_SAVED_SCANS})</p>
      )}

      <div className="space-y-3">
        {scans.map((s, i) => (
          <div key={s.id}>
            {saved && saved.length > 0 && i === saved.length && (
              <p className="mb-2 mt-5 text-xs font-medium text-muted">Recent</p>
            )}
            <div className="rounded-chip border border-line bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-medium">{s.url}</span>
                <div className="flex items-center gap-2">
                  <MetricChip label="Status" value={s.status} tone={STATUS_TONE[s.status] ?? "default"} />
                  <SaveScanButton scanId={s.id} initialSaved={s.is_saved} />
                </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}

