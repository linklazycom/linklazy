import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { DrBadge } from "@/components/sites/dr-badge";
import { PayPerViewSettings } from "@/components/sites/pay-per-view-settings";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  approved: "verified",
  pending: "price",
  rejected: "default",
  suspended: "default",
};

export default async function MySitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sites } = await supabase
    .from("sites")
    .select(
      "id, domain, niche, status, da, dr, dr_verified, organic_traffic, price_amount, pay_per_view_enabled, view_price, access_duration_days"
    )
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">My sites</h1>
        <Link href="/dashboard/sites/new">
          <Button>List a new site</Button>
        </Link>
      </div>

      {!sites?.length && (
        <div className="rounded-chip border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">
            You haven&apos;t listed any sites yet. List one to start receiving
            exchange proposals and paid orders.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sites?.map((site) => (
          <div key={site.id} className="rounded-chip border border-line bg-white p-4">
            <Link href={`/dashboard/sites/${site.id}/verify`} className="block hover:opacity-80">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{site.domain}</span>
                <MetricChip
                  label="Status"
                  value={site.status}
                  tone={STATUS_TONE[site.status] ?? "default"}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Niche" value={site.niche} />
                {site.da != null && <MetricChip label="DA" value={site.da} />}
                {(site.dr != null || site.dr_verified != null) && (
                  <DrBadge selfReportedDr={site.dr} verifiedDr={site.dr_verified} />
                )}
                {site.organic_traffic != null && (
                  <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
                )}
                {site.price_amount != null && (
                  <MetricChip label="Price" value={site.price_amount} tone="price" />
                )}
              </div>
            </Link>
            <Link
              href={`/dashboard/sites/${site.id}/slots`}
              className="mt-3 inline-block text-sm text-ink underline"
            >
              Manage link slots
            </Link>
            {site.status === "approved" && (
              <Link
                href={`/dashboard/sites/${site.id}/matches`}
                className="mt-3 ml-4 inline-block text-sm text-brand-violet underline"
              >
                Find exchange partners
              </Link>
            )}
            {site.status === "approved" && (
              <PayPerViewSettings
                siteId={site.id}
                initialEnabled={site.pay_per_view_enabled}
                initialPrice={site.view_price}
                initialDurationDays={site.access_duration_days}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
