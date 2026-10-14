import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { domainForViewer } from "@/lib/match-flow";

/** One proposal, only for the owners of its two sites. The other party's domain stays masked until accepted. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: match } = await service
    .from("exchange_matches")
    .select("id, status, match_score, initiated_by, proposed_terms, counter_terms, site_a_id, site_b_id")
    .eq("id", id)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sites } = await service
    .from("sites")
    .select("id, owner_id, domain")
    .in("id", [match.site_a_id, match.site_b_id]);
  const a = sites?.find((s) => s.id === match.site_a_id);
  const b = sites?.find((s) => s.id === match.site_b_id);
  if (!a || !b || (a.owner_id !== user.id && b.owner_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    userId: user.id,
    match: {
      id: match.id,
      status: match.status,
      match_score: match.match_score,
      initiated_by: match.initiated_by,
      proposed_terms: match.proposed_terms,
      counter_terms: match.counter_terms,
      site_a: { id: a.id, owner_id: a.owner_id, domain: domainForViewer(a, user.id, match.status) },
      site_b: { id: b.id, owner_id: b.owner_id, domain: domainForViewer(b, user.id, match.status) },
    },
  });
}
