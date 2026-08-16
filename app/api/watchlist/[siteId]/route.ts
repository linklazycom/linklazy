import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Capture today's price as the baseline for price-drop alerts — the
  // weekly cron compares the site's current price against this and resets
  // it after notifying, so re-watching after a drop starts a fresh baseline.
  const { data: site } = await supabase
    .from("sites")
    .select("price_amount")
    .eq("id", siteId)
    .single();

  const { error } = await supabase.from("watchlists").upsert(
    { user_id: user.id, site_id: siteId, price_at_watch: site?.price_amount ?? null },
    { onConflict: "user_id,site_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, watching: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("user_id", user.id)
    .eq("site_id", siteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, watching: false });
}
