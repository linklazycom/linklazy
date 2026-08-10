import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: pendingSites },
    { count: openDisputes },
    { count: totalUsers },
    { count: flaggedUsers },
    { count: activeOrders },
    { count: newContactMessages },
  ] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_flagged", true),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(accepted,cancelled,refunded)"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const cards = [
    { label: "Pending site approvals", value: pendingSites ?? 0, href: "/admin/sites", urgent: !!pendingSites },
    { label: "Open disputes", value: openDisputes ?? 0, href: "/admin/disputes", urgent: !!openDisputes },
    { label: "Total users", value: totalUsers ?? 0, href: "/admin/users", urgent: false },
    { label: "Flagged accounts", value: flaggedUsers ?? 0, href: "/admin/users", urgent: !!flaggedUsers },
    { label: "Active orders", value: activeOrders ?? 0, href: "/admin/orders", urgent: false },
    { label: "New contact messages", value: newContactMessages ?? 0, href: "/admin/contact-messages", urgent: !!newContactMessages },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-chip border p-5 hover:border-brand-violet ${
              c.urgent ? "border-amber/40 bg-amber-soft" : "border-line bg-white"
            }`}
          >
            <p className="mb-1 text-xs text-muted">{c.label}</p>
            <p className={`font-display text-2xl font-medium ${c.urgent ? "text-amber" : ""}`}>
              {c.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
