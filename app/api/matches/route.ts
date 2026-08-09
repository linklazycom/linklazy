import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { proposeMatchSchema } from "@/lib/validators/match";
import { computeMatchScore } from "@/lib/match-score";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = proposeMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  const { data: siteA } = await supabase
    .from("sites")
    .select("id, owner_id, da, niche, status, accepts_exchange")
    .eq("id", input.site_a_id)
    .single();
  const { data: siteB } = await supabase
    .from("sites")
    .select("id, owner_id, da, niche, status, accepts_exchange")
    .eq("id", input.site_b_id)
    .single();

  if (!siteA || siteA.owner_id !== user.id) {
    return NextResponse.json({ error: "You don't own site A" }, { status: 403 });
  }
  if (!siteB || siteB.status !== "approved" || !siteB.accepts_exchange) {
    return NextResponse.json({ error: "Target site isn't available for exchange" }, { status: 400 });
  }
  if (siteA.owner_id === siteB.owner_id) {
    return NextResponse.json({ error: "Can't propose an exchange with your own site" }, { status: 400 });
  }

  // Prevent duplicate active proposals between the same two sites.
  const { data: existing } = await supabase
    .from("exchange_matches")
    .select("id")
    .in("status", ["proposed", "countered"])
    .or(
      `and(site_a_id.eq.${input.site_a_id},site_b_id.eq.${input.site_b_id}),and(site_a_id.eq.${input.site_b_id},site_b_id.eq.${input.site_a_id})`
    )
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "There's already an open proposal between these sites" }, { status: 400 });
  }

  const score = computeMatchScore(siteA, siteB);

  const { data: match, error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: match.id });
}
