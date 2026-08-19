import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSiteSettings } from "@/lib/site-settings";
import type { NavLink } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader navLinks={settings.nav_links as NavLink[]} isLoggedIn={Boolean(user)} />
      {children}
      <SiteFooter
        footerLinks={settings.footer_links as Record<string, NavLink[]>}
        contactEmail={settings.contact_email as string}
      />
    </>
  );
}
