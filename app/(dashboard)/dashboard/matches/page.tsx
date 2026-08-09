import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

const STATUS_TONE: Record<string, "verified" | "price" | "default"> = {
  accepted: "verified",
  proposed: "price",
  countered: "price",
  rejected: "default",
  expired: "default",
};

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mySites } = await supabase.from("sites").select("id").eq("owner_id", user!.id);
  const mySiteIds = (mySites ?? []).map((s) => s.id);

  if (!mySiteIds.length) {
    return (
      <div>
        <h1 className="mb-4 font-display text-2xl font-medium">Exchange matches</h1>
        <p className="text-muted">
          List a site first, then visit its &quot;Find exchange partners&quot;
          page to send proposals.
        </p>
      </div>
    );
  }

  const { data: matches } = await supabase
    .from("exchange_matches")
    .select("id, status, match_score, initiated_by, created_at, site_a:site_a_id(id, domain), site_b:site_b_id(id, domain)")
    .or(mySiteIds.map((id) => `site_a_id.eq.${id}`).concat(mySiteIds.map((id) => `site_b_id.eq.${id}`)).join(","))
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Exchange matches</h1>
      <div className="space-y-3">
        {matches?.map((m) => {
          const siteA = m.site_a as unknown as { id: string; domain: string };
          const siteB = m.site_b as unknown as { id: string; domain: string };
          const waitingOnMe = m.initiated_by !== user!.id && ["proposed", "countered"].includes(m.status);

          return (
            <Link
              key={m.id}
              href={`/dashboard/matches/${m.id}`}
              className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">
                  {siteA?.domain} ↔ {siteB?.domain}
                </span>
                <MetricChip label="Status" value={m.status} tone={STATUS_TONE[m.status] ?? "default"} />
              </div>
              <div className="flex flex-wrap gap-2">
                {m.match_score != null && <MetricChip label="Match" value={`${m.match_score}%`} />}
                {waitingOnMe && <MetricChip label="Action needed" value="Respond" tone="price" />}
              </div>
            </Link>
          );
        })}
        {!matches?.length && <p className="text-muted">No exchange proposals yet.</p>}
      </div>
    </div>
  );
}
