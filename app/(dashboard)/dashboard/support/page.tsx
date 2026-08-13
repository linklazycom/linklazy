import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";

export default async function MyTicketsPage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">My tickets</h1>
        <Link href="/support">
          <Button size="sm">New ticket</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {tickets?.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/support/${t.id}`}
            className="block rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{t.subject}</span>
              <MetricChip
                label="Status"
                value={t.status}
                tone={t.status === "open" ? "price" : t.status === "closed" ? "verified" : "default"}
              />
            </div>
            <p className="text-xs text-muted">
              Updated {new Date(t.updated_at).toLocaleString()}
            </p>
          </Link>
        ))}
        {!tickets?.length && (
          <p className="text-muted">
            No tickets yet.{" "}
            <Link href="/support" className="underline">
              Open one
            </Link>{" "}
            if you need help.
          </p>
        )}
      </div>
    </div>
  );
}
