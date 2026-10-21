import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { AdminSidebarNav, type AdminNavGroup } from "@/components/layout/admin-sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebarShell } from "@/components/layout/mobile-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ToastProvider } from "@/components/ui/toast-provider";

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
      { href: "/admin/sites/bulk-import", label: "Bulk import sites" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/disputes", label: "Disputes" },
      { href: "/admin/press-releases", label: "Press releases" },
      { href: "/admin/case-studies", label: "Case studies" },
    ],
  },
  {
    label: "Links",
    items: [
      { href: "/admin/links", label: "Short links" },
      { href: "/admin/links/reports", label: "Abuse reports" },
      { href: "/admin/links/blocklist", label: "Blocklist" },
      { href: "/admin/domains", label: "Custom domains" },
      { href: "/admin/bio", label: "Bio pages" },
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
      { href: "/admin/payments", label: "Payment health" },
      { href: "/admin/withdrawals", label: "Withdrawals" },
      { href: "/admin/ppv-unlocks", label: "Pay-per-view unlocks" },
      { href: "/admin/wallet-ledger", label: "Wallet ledger" },
      { href: "/admin/reconciliation", label: "Wallet reconciliation" },
      { href: "/admin/usage-pricing", label: "Usage pricing" },
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
    label: "Outreach",
    href: "/admin/outreach",
    items: [
      { href: "/admin/outreach", label: "Overview & safety" },
      { href: "/admin/outreach/contacts", label: "Contacts" },
      { href: "/admin/outreach/import", label: "Import contacts" },
      { href: "/admin/outreach/saleshandy", label: "Saleshandy connection" },
      { href: "/admin/outreach/campaigns", label: "Campaigns" },
      { href: "/admin/outreach/delivery", label: "Delivery report" },
      { href: "/admin/outreach/tickets", label: "Replies (tickets)" },
      { href: "/admin/outreach/template", label: "Email template" },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/admin/support", label: "Support tickets" },
      { href: "/admin/contact-messages", label: "Contact messages" },
    ],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    items: [
      { href: "/admin/settings", label: "General settings" },
      { href: "/admin/api-providers", label: "API Providers" },
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

  if (!user) {
    redirect("/login?next=/admin");
  }

  // The admin layout previously rendered for anyone logged in — the actual
  // data underneath was mostly still RLS/API-gated, but the admin shell
  // itself (nav, page structure) was visible to non-admins, and some
  // admin pages read data with the session-scoped client rather than
  // going through requireAdmin(). Gate the whole section explicitly here
  // so a missing check on any individual page can't expose anything.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

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

  // ToastProvider must wrap the admin pages: /admin/api-providers calls
  // useToast(), which throws when no provider is mounted (that crash is what
  // showed "Couldn't load the admin panel").
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
