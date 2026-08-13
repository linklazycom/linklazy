import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, name, email, subject, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Support tickets</h1>
      <div className="space-y-3">
        {tickets?.map((t) => (
          <Link
            key={t.id}
            href={`/admin/support/${t.id}`}
            className="block rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {t.subject} <span className="text-muted">— {t.name}</span>
              </span>
              <MetricChip
                label="Status"
                value={t.status}
                tone={t.status === "open" ? "price" : t.status === "closed" ? "verified" : "default"}
              />
            </div>
            <p className="text-xs text-muted">
              {t.email} · updated {new Date(t.updated_at).toLocaleString()}
            </p>
          </Link>
        ))}
        {!tickets?.length && <p className="text-muted">No support tickets yet.</p>}
      </div>
    </div>
  );
}
