import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Already unlocked? No charge.
  const { data: existing } = await supabase
    .from("credits_ledger")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "unlock_spend")
    .eq("related_site_id", siteId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, alreadyUnlocked: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("buyer_plan, buyer_views_quota, buyer_views_used")
    .eq("id", user.id)
    .single();

  if (!profile || profile.buyer_plan === "free") {
    return NextResponse.json(
      { error: "Upgrade to a paid plan to unlock site details." },
      { status: 402 }
    );
  }

  if (profile.buyer_views_used >= profile.buyer_views_quota) {
    return NextResponse.json(
      { error: "You've used all your views for this billing period." },
      { status: 402 }
    );
  }

  const newUsed = profile.buyer_views_used + 1;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ buyer_views_used: newUsed })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.from("credits_ledger").insert({
    user_id: user.id,
    amount: -1,
    type: "unlock_spend",
    related_site_id: siteId,
    balance_after: profile.buyer_views_quota - newUsed,
    notes: "Site detail unlock",
  });

  return NextResponse.json({ ok: true, alreadyUnlocked: false });
}
