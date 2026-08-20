import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { AdminSidebarNav, type AdminNavGroup } from "@/components/layout/admin-sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebarShell } from "@/components/layout/mobile-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    href: "/admin",
    items: [
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/revenue", label: "Revenue" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/admin/sites", label: "Sites" },
      { href: "/admin/sites/new", label: "List a site" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/disputes", label: "Disputes" },
      { href: "/admin/press-releases", label: "Press releases" },
    ],
  },
  {
    label: "Users",
    items: [
      { href: "/admin/users", label: "All users" },
      { href: "/admin/users/new", label: "Create user" },
      { href: "/admin/campaigns", label: "Email campaigns" },
    ],
  },
  {
    label: "Payments",
    items: [
      { href: "/admin/withdrawals", label: "Withdrawals" },
      { href: "/admin/ppv-unlocks", label: "Pay-per-view unlocks" },
      { href: "/admin/wallet-ledger", label: "Wallet ledger" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/articles", label: "Blog / CMS" },
      { href: "/admin/articles/categorize", label: "Bulk-categorize articles" },
      { href: "/admin/niche-coverage", label: "Niche keyword coverage" },
      { href: "/admin/ai-detection", label: "AI niche detection" },
    ],
  },
  {
    label: "Support",
    items: [{ href: "/admin/support", label: "Support tickets" }],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    items: [
      { href: "/admin/settings", label: "General settings" },
      { href: "/admin/pricing", label: "Pricing page" },
      { href: "/admin/coupons", label: "Coupons" },
      { href: "/admin/ads", label: "Ads" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sidebarContent = (
    <>
      <Link href="/" className="mb-1 block">
        <Logo size={24} />
      </Link>
      <p className="mb-7 text-xs text-muted">Admin</p>
      <AdminSidebarNav groups={NAV_GROUPS} />
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-4 text-xs text-muted">
        <Link href="/dashboard" className="hover:text-ink">
          Switch to dashboard
        </Link>
        <span>·</span>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileSidebarShell>{sidebarContent}</MobileSidebarShell>
      <main className="flex-1 bg-paper p-4 md:p-8">
        {user && (
          <div className="mb-4 flex justify-end">
            <NotificationBell userId={user.id} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
