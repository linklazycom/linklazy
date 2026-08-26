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
 *  - no active ad_slots row exists for this placement.
 *
 * (Ads used to also have a "free_only" audience mode, hidden from buyers
 * on a paid subscription plan. Subscription plans were removed
 * product-wide, so that distinction no longer means anything — every
 * buyer is on the same "free" plan forever now — and the option was
 * dropped from Admin -> Ads accordingly.)
 */
export async function AdSlot({ placement }: { placement: string }) {
  const settings = await getSiteSettings();
  const adsEnabled = (settings.ads_enabled as string) ?? "off";
  if (adsEnabled === "off") return null;

  const supabase = await createClient();

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
