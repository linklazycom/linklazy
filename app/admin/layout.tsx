import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sites", label: "Site approvals" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-line bg-white p-6">
        <Link href="/" className="mb-8 block font-display text-lg font-semibold">
          LinkLazy <span className="text-xs font-normal text-muted">Admin</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-chip px-3 py-2 text-sm text-ink hover:bg-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
