import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebarShell } from "@/components/layout/mobile-sidebar-shell";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sites", label: "Site approvals" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/articles", label: "Blog / CMS" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/support", label: "Support tickets" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const sidebarContent = (
    <>
      <Link href="/" className="mb-1 block">
        <Logo size={24} />
      </Link>
      <p className="mb-7 text-xs text-muted">Admin</p>
      <SidebarNav items={NAV} />
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
      <main className="flex-1 bg-paper p-4 md:p-8">{children}</main>
    </div>
  );
}
