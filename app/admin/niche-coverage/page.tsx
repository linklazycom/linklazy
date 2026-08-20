import { createClient } from "@/lib/supabase/server";
import { NICHES } from "@/lib/niches";
import { NICHE_KEYWORDS } from "@/lib/niche-keywords";
import { MetricChip } from "@/components/ui/metric-chip";

/**
 * Helps catch the exact bug we hit with birdever.com/crowadvice.com:
 * a niche with too few/too-narrow keywords silently produces bad or
 * zero scan matches. This page surfaces that before a buyer complains.
 */
export default async function NicheCoveragePage() {
  const supabase = await createClient();

  const { data: siteCounts } = await supabase
    .from("sites")
    .select("niche")
    .eq("status", "approved");

  const countByNiche = new Map<string, number>();
  for (const row of siteCounts ?? []) {
    countByNiche.set(row.niche, (countByNiche.get(row.niche) ?? 0) + 1);
  }

  // Recent scans that failed to detect a niche, or matched with low
  // confidence — the clearest signal that a keyword list needs work.
  const { data: weakScans } = await supabase
    .from("buyer_site_scans")
    .select("id, url, detected_niche, confidence, status, error_message, created_at")
    .or("status.eq.failed,confidence.lt.40")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Niche keyword coverage</h1>
      <p className="mb-6 text-sm text-muted">
        Keyword-based site scanning only works as well as the dictionary in{" "}
        <code>lib/niche-keywords.ts</code>. Niches with very few keywords, or with zero approved
        sites, are the ones most likely to produce bad or empty scan results for buyers.
      </p>

      <h2 className="mb-3 font-display text-lg font-medium">Coverage by niche</h2>
      <div className="mb-8 overflow-x-auto rounded-chip border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas text-left text-muted">
            <tr>
              <th className="px-4 py-2">Niche</th>
              <th className="px-4 py-2">Keywords in dictionary</th>
              <th className="px-4 py-2">Approved sites</th>
              <th className="px-4 py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {NICHES.map((niche) => {
              const kwCount = NICHE_KEYWORDS[niche]?.length ?? 0;
              const siteCount = countByNiche.get(niche) ?? 0;
              const thin = kwCount < 8;
              const empty = siteCount === 0;
              return (
                <tr key={niche} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{niche}</td>
                  <td className="px-4 py-2">{kwCount}</td>
                  <td className="px-4 py-2">{siteCount}</td>
                  <td className="px-4 py-2">
                    {thin && (
                      <MetricChip label="" value="Thin keyword list" tone="price" />
                    )}
                    {empty && <MetricChip label="" value="No approved sites" tone="default" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 font-display text-lg font-medium">
        Recent weak/failed scans (last 30)
      </h2>
      <p className="mb-3 text-sm text-muted">
        Failed scans, or matches under 40% confidence — check the URL and consider adding its
        obvious topic words to that niche&apos;s keyword list.
      </p>
      <div className="space-y-2">
        {weakScans?.map((s) => (
          <div key={s.id} className="rounded-chip border border-line bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono">{s.url}</span>
              <span className="text-muted">{new Date(s.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-muted">
              {s.status === "failed"
                ? `Failed — ${s.error_message ?? "no niche detected"}`
                : `Detected: ${s.detected_niche} (${s.confidence}% confidence)`}
            </p>
          </div>
        ))}
        {!weakScans?.length && (
          <p className="text-sm text-muted">No weak or failed scans recently — good sign.</p>
        )}
      </div>
    </div>
  );
}
