import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const startSchema = z.object({ site_id: z.string().uuid() });

/**
 * Gets or creates the single inquiry thread for (site, current user as
 * buyer). Idempotent — calling this again for a site the buyer already
 * messaged just returns the existing inquiry id instead of erroring, so
 * the "Message seller" button can always call this before navigating.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id")
    .eq("id", parsed.data.site_id)
    .single();

  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (site.owner_id === user.id) {
    return NextResponse.json({ error: "You can't message yourself about your own site" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("inquiries")
    .select("id")
    .eq("site_id", site.id)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ id: existing.id });

  const { data: created, error } = await supabase
    .from("inquiries")
    .insert({ site_id: site.id, buyer_id: user.id, seller_id: site.owner_id })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Could not start conversation" }, { status: 500 });
  }

  return NextResponse.json({ id: created.id });
}

/** Lists the current user's inquiries (as buyer or seller), newest first. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("inquiries")
    .select("id, site_id, buyer_id, seller_id, updated_at, sites(domain)")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [] });
}
