import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminContactMessagesPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Contact messages</h1>
      <div className="space-y-3">
        {messages?.map((m) => (
          <div key={m.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {m.name} <span className="text-muted">— {m.email}</span>
              </span>
              <MetricChip label="Status" value={m.status} tone={m.status === "new" ? "price" : "verified"} />
            </div>
            <p className="text-sm text-ink">{m.message}</p>
            <p className="mt-2 text-xs text-muted">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        ))}
        {!messages?.length && <p className="text-muted">No messages yet.</p>}
      </div>
    </div>
  );
}
