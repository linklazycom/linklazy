import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { proposeMatchSchema } from "@/lib/validators/match";
import { computeMatchScore } from "@/lib/match-score";

/**
 * SECURITY (Batch 7C): exchange_matches can no longer be written from the
 * browser (SQL 029 removes the open write policy). Every check that the
 * policy used to (not) do happens here, and the insert uses the server client.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = proposeMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;
  if (input.site_a_id === input.site_b_id) {
    return NextResponse.json({ error: "Pick two different sites" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: sites } = await service
    .from("sites")
    .select("id, owner_id, da, niche, status, accepts_exchange")
    .in("id", [input.site_a_id, input.site_b_id]);
  const siteA = sites?.find((s) => s.id === input.site_a_id);
  const siteB = sites?.find((s) => s.id === input.site_b_id);

  if (!siteA || siteA.owner_id !== user.id) {
    return NextResponse.json({ error: "You don't own site A" }, { status: 403 });
  }
  if (siteA.status !== "approved") {
    return NextResponse.json({ error: "Your site must be approved before proposing an exchange" }, { status: 400 });
  }
  if (!siteB || siteB.status !== "approved" || !siteB.accepts_exchange) {
    return NextResponse.json({ error: "Target site isn't available for exchange" }, { status: 400 });
  }
  if (siteA.owner_id === siteB.owner_id) {
    return NextResponse.json({ error: "Can't propose an exchange with your own site" }, { status: 400 });
  }

  // Prevent duplicate active proposals between the same two sites.
  const { data: existing } = await service
    .from("exchange_matches")
    .select("id")
    .in("status", ["proposed", "countered"])
    .or(
      `and(site_a_id.eq.${input.site_a_id},site_b_id.eq.${input.site_b_id}),and(site_a_id.eq.${input.site_b_id},site_b_id.eq.${input.site_a_id})`
    )
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "There's already an open proposal between these sites" }, { status: 400 });
  }

  const score = computeMatchScore(siteA, siteB);

  const { data: match, error } = await service
    .from("exchange_matches")
    .insert({
      site_a_id: input.site_a_id,
      site_b_id: input.site_b_id,
      initiated_by: user.id,
      status: "proposed",
      match_score: score,
      proposed_terms: {
        from_a: { target_url: input.my_target_url, anchor_text: input.my_anchor_text },
        from_b: { target_url: input.their_target_url, anchor_text: input.their_anchor_text },
        notes: input.notes,
      },
    })
    .select("id")
    .single();

  if (error || !match) return NextResponse.json({ error: error?.message ?? "Could not create proposal" }, { status: 500 });
  return NextResponse.json({ id: match.id });
}
