import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { AdHtmlRenderer } from "@/components/ads/ad-html-renderer";

interface AdSlotRow {
  id: string;
  placement: string;
  kind: "image_link" | "html";
  image_url: string | null;
  link_url: string | null;
  html_code: string | null;
  alt_text: string | null;
}

/**
 * Renders nothing if:
 *  - the global site_settings.ads_enabled kill switch is "off", or
 *  - no active ad_slots row exists for this placement, or
 *  - ads_enabled is "free_only" and the current user is on a paid plan.
 *
 * Logged-out visitors always count as "free" for the free_only check —
 * they haven't paid for anything.
 */
export async function AdSlot({ placement }: { placement: string }) {
  const settings = await getSiteSettings();
  const adsEnabled = (settings.ads_enabled as string) ?? "off";
  if (adsEnabled === "off") return null;

  const supabase = await createClient();

  if (adsEnabled === "free_only") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("buyer_plan")
        .eq("id", user.id)
        .single();
      const isPaid = profile?.buyer_plan && profile.buyer_plan !== "free";
      if (isPaid) return null;
    }
  }

  const { data: slots } = await supabase
    .from("ad_slots")
    .select("id, placement, kind, image_url, link_url, html_code, alt_text")
    .eq("placement", placement)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  const slot = (slots as AdSlotRow[] | null)?.[0];
  if (!slot) return null;

  if (slot.kind === "html" && slot.html_code) {
    return (
      <div className="ad-slot my-4" data-placement={placement}>
        <AdHtmlRenderer html={slot.html_code} />
      </div>
    );
  }

  if (slot.kind === "image_link" && slot.image_url) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element -- ad creative is arbitrary admin-supplied content, not an optimizable local asset
      <img src={slot.image_url} alt={slot.alt_text ?? "Advertisement"} className="mx-auto max-w-full rounded-chip" />
    );
    return (
      <div className="ad-slot my-4 text-center" data-placement={placement}>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Sponsored</p>
        {slot.link_url ? (
          <a href={slot.link_url} target="_blank" rel="noopener noreferrer nofollow sponsored">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    );
  }

  return null;
}
