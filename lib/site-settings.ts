import { createClient } from "@/lib/supabase/server";

export interface NavLink {
  label: string;
  href: string;
}

const DEFAULTS: Record<string, unknown> = {
  nav_links: [
    { label: "Browse Sites", href: "/browse" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
  ],
  footer_links: {
    Company: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    Legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
    ],
    Resources: [
      { label: "Blog", href: "/blog" },
      { label: "How it works", href: "/how-it-works" },
    ],
  },
  social_links: { facebook: "", twitter: "", linkedin: "" },
  contact_email: "support@linklazy.com",
  ga_measurement_id: "",
  gsc_verification_code: "",
  bing_verification_code: "",
  pinterest_verification_code: "",
  yandex_verification_code: "",
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
