import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { fetchDomainRating } from "@/lib/ahrefs";

/**
 * Manual DR re-check for a single site, used by the admin site detail page
 * (e.g. after a dispute over inflated metrics, or right after approval
 * instead of waiting for the weekly cron).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const { id } = await params;
  const { supabase } = auth;

  const { data: site } = await supabase.from("sites").select("id, domain").eq("id", id).single();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const result = await fetchDomainRating(site.domain);

  if (!result.ok || result.domainRating == null) {
    await supabase.from("sites").update({ dr_check_status: "failed" }).eq("id", id);
    return NextResponse.json({ error: result.error ?? "DR check failed" }, { status: 502 });
  }

  await supabase
    .from("sites")
    .update({
      dr_verified: result.domainRating,
      dr_verified_at: new Date().toISOString(),
      dr_check_status: "ok",
    })
    .eq("id", id);

  return NextResponse.json({ dr_verified: result.domainRating });
}
