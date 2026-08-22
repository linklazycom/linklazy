import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchDomainRating } from "@/lib/ahrefs";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

/**
 * Weekly job: refresh the Ahrefs-verified Domain Rating for approved sites,
 * oldest-checked-first, so every site gets refreshed roughly once a week
 * even as the catalog grows. Runs sequentially with a delay between calls
 * to stay well within Ahrefs' free-endpoint rate limit — this is a batch
 * job, not a live lookup, so a few minutes of runtime is fine.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: sites } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("status", "approved")
    .order("dr_verified_at", { ascending: true, nullsFirst: true })
    .limit(150); // batch size per run; weekly cadence catches up the rest over time

  if (!sites?.length) {
    return NextResponse.json({ checked: 0, ok: 0, failed: 0 });
  }

  let ok = 0;
  let failed = 0;

  for (const site of sites) {
    const result = await fetchDomainRating(site.domain);

    if (result.ok && result.domainRating != null) {
      ok++;
      await supabase
        .from("sites")
        .update({
          dr_verified: result.domainRating,
          dr_verified_at: new Date().toISOString(),
          dr_check_status: "ok",
        })
        .eq("id", site.id);
    } else {
      failed++;
      // Keep the last good dr_verified value; just mark status so admins
      // can see the check failed rather than silently going stale.
      await supabase
        .from("sites")
        .update({ dr_check_status: "failed" })
        .eq("id", site.id);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return NextResponse.json({ checked: sites.length, ok, failed });
}
