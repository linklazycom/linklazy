import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { domainForViewer } from "@/lib/match-flow";
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

  // The page only shows proposals involving the signed-in user's own sites (filter above).
  // Reads use the server client because the other party's site row is no longer
  // readable from the browser-level client; their domain is masked until accepted.
  const service = createServiceClient();
  const { data: rawMatches } = await service
    .from("exchange_matches")
    .select("id, status, match_score, initiated_by, created_at, site_a_id, site_b_id")
    .or(mySiteIds.map((id) => `site_a_id.eq.${id}`).concat(mySiteIds.map((id) => `site_b_id.eq.${id}`)).join(","))
    .order("created_at", { ascending: false });

  const allIds = Array.from(new Set((rawMatches ?? []).flatMap((m) => [m.site_a_id as string, m.site_b_id as string])));
  const { data: siteRows } = allIds.length
    ? await service.from("sites").select("id, owner_id, domain").in("id", allIds)
    : { data: [] as { id: string; owner_id: string; domain: string }[] };
  const siteById = new Map((siteRows ?? []).map((s) => [s.id as string, s as { id: string; owner_id: string; domain: string }]));
  const matches = (rawMatches ?? []).map((m) => {
    const a = siteById.get(m.site_a_id as string);
    const b = siteById.get(m.site_b_id as string);
    return {
      ...m,
      site_a: a ? { id: a.id, domain: domainForViewer(a, user!.id, m.status as string) } : null,
      site_b: b ? { id: b.id, domain: domainForViewer(b, user!.id, m.status as string) } : null,
    };
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Exchange matches</h1>
      <div className="space-y-3">
        {matches?.map((m) => {
          const siteA = m.site_a;
          const siteB = m.site_b;
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
