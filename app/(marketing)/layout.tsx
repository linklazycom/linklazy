import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSiteSettings } from "@/lib/site-settings";
import type { NavLink } from "@/lib/site-settings";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteHeader navLinks={settings.nav_links as NavLink[]} />
      {children}
      <SiteFooter
        footerLinks={settings.footer_links as Record<string, NavLink[]>}
        contactEmail={settings.contact_email as string}
      />
    </>
  );
}
