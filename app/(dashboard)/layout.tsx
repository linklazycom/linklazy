import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebarShell } from "@/components/layout/mobile-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sites", label: "My sites" },
  { href: "/dashboard/analytics", label: "My analytics" },
  { href: "/browse", label: "Browse" },
  { href: "/dashboard/matches", label: "Exchange matches" },
  { href: "/dashboard/watchlist", label: "Watchlist" },
  { href: "/dashboard/saved-searches", label: "Saved searches" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/referrals", label: "Referrals" },
  { href: "/dashboard/support", label: "My tickets" },
  { href: "/dashboard/billing", label: "Billing" },
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
      <SidebarNav items={NAV} />
      <div className="mt-auto border-t border-line pt-4 text-xs text-muted">
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
        <div className="mb-4 flex justify-end">
          <NotificationBell userId={user.id} />
        </div>
        {children}
      </main>
    </div>
  );
}
