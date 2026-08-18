import { createClient } from "@/lib/supabase/server";

export interface NavLink {
  label: string;
  href: string;
}

const DEFAULTS: Record<string, unknown> = {
  // Kept short on purpose — the header row also holds the search box, logo,
  // currency toggle, and auth buttons. Niches/Blog live in the footer's
  // Resources column instead (see footer_links below) so the header doesn't
  // overflow/wrap on smaller desktop widths. Pricing stays in both places
  // since it's a common landing point for new visitors.
  nav_links: [
    { label: "Browse Sites", href: "/browse" },
    { label: "Pricing", href: "/pricing" },
    { label: "Press releases", href: "/press-releases" },
  ],
  footer_links: {
    Company: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "How it works", href: "/how-it-works" },
    ],
    Legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Trust & payment protection", href: "/trust" },
    ],
    Resources: [
      { label: "Niches", href: "/niches" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
    ],
  },
  social_links: { facebook: "", twitter: "", linkedin: "" },
  contact_email: "support@linklazy.com",
  ga_measurement_id: "",
  gsc_verification_code: "",
  bing_verification_code: "",
  pinterest_verification_code: "",
  yandex_verification_code: "",
  ads_enabled: "off",
  // Starting-number offsets for the /trust page counters — the same
  // idea as a hospital numbering its 6th-floor rooms from 6001 rather
  // than 1. These are added on top of real counts so the page never
  // shows a blank "0" on a brand-new site, and every real completed
  // order/resolved dispute increments the number from here on.
  // Admin-configurable at /admin/settings. Defaults to 0 (no offset)
  // until an admin sets a starting number.
  trust_orders_base: "0",
  trust_disputes_resolved_base: "0",
};

/** Fetches every site_settings row and merges over the safe defaults. */
export async function getSiteSettings(): Promise<Record<string, unknown>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("key, value");
    const merged = { ...DEFAULTS };
    for (const row of data ?? []) {
      merged[row.key] = row.value;
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}
