import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sites", label: "My sites" },
  { href: "/dashboard/browse", label: "Browse" },
  { href: "/dashboard/orders", label: "Orders" },
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-line bg-white p-6">
        <Link href="/" className="mb-8 block font-display text-lg font-semibold">
          LinkLazy
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
        <div className="mt-10 border-t border-line pt-4 text-xs text-muted">
          {profile?.full_name ?? user.email}
          <div className="mt-1 capitalize">{String(profile?.role ?? "buyer")}</div>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
