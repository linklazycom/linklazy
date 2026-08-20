import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { AdminSidebarNav, type AdminNavGroup } from "@/components/layout/admin-sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebarShell } from "@/components/layout/mobile-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { VerifyEmailBanner } from "@/components/layout/verify-email-banner";
import { GlobalSearch } from "@/components/search/global-search";
import { AdSlot } from "@/components/ads/ad-slot";

const NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    href: "/dashboard",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/analytics", label: "My analytics" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/browse", label: "Browse" },
      { href: "/dashboard/sites", label: "My sites" },
      { href: "/dashboard/scan-site", label: "Scan my site for links" },
      { href: "/dashboard/matches", label: "Exchange matches" },
      { href: "/dashboard/watchlist", label: "Watchlist" },
      { href: "/dashboard/saved-searches", label: "Saved searches" },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/dashboard/orders", label: "Orders" },
      { href: "/dashboard/inquiries", label: "Pre-sale inquiries" },
      { href: "/dashboard/press-releases", label: "Press releases" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/messages", label: "Messages" },
      { href: "/dashboard/support", label: "My tickets" },
      { href: "/dashboard/referrals", label: "Referrals" },
      { href: "/dashboard/billing", label: "Billing" },
      { href: "/dashboard/wallet", label: "Wallet" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const sidebarContent = (
    <>
      <Link href="/" className="mb-8 block">
        <Logo size={24} />
      </Link>
      <AdminSidebarNav groups={NAV} />
      <div className="mt-auto border-t border-line pt-4 text-xs text-muted">
        <AdSlot placement="dashboard_sidebar" />
        <Link href="/dashboard/profile" className="block hover:text-ink">
          {profile?.full_name ?? user.email}
        </Link>
        <div className="mb-3 mt-1 capitalize">{String(profile?.role ?? "buyer")}</div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profile" className="hover:text-ink">
            Profile
          </Link>
          <span>·</span>
          <LogoutButton />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileSidebarShell>{sidebarContent}</MobileSidebarShell>
      <main className="flex-1 bg-paper p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <GlobalSearch browseHref="/dashboard/browse" className="max-w-sm min-w-0 flex-1" />
          <NotificationBell userId={user.id} />
        </div>
        {!user.email_confirmed_at && user.email && <VerifyEmailBanner email={user.email} />}
        {children}
      </main>
    </div>
  );
}
