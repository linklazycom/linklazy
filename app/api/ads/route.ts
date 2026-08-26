import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * Client-safe counterpart to components/ads/ad-slot.tsx (a server
 * component). Pages that are "use client" (like the site detail pages,
 * which fetch everything client-side after checking view-unlock status)
 * can't import next/headers-based server code directly, so they hit this
 * route instead and render with AdSlotClient.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placement = searchParams.get("placement");
  if (!placement) return NextResponse.json({ slot: null });

  const settings = await getSiteSettings();
  const adsEnabled = (settings.ads_enabled as string) ?? "off";
  if (adsEnabled === "off") return NextResponse.json({ slot: null });

  const supabase = await createClient();

  const { data: slots } = await supabase
    .from("ad_slots")
    .select("id, kind, image_url, link_url, html_code, alt_text")
    .eq("placement", placement)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  return NextResponse.json({ slot: slots?.[0] ?? null });
}
