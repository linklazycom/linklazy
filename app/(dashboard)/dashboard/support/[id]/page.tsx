import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { DashboardTicketReplyForm } from "@/components/support/dashboard-ticket-reply-form";

export default async function MyTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS ("users can view their own tickets") means this simply returns
  // nothing if the ticket doesn't belong to the logged-in user.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("id", id)
    .single();

  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("id, sender_type, sender_name, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">{ticket.subject}</h1>
        <MetricChip
          label="Status"
          value={ticket.status}
          tone={ticket.status === "open" ? "price" : ticket.status === "closed" ? "verified" : "default"}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`rounded-chip border p-4 ${
              m.sender_type === "admin"
                ? "border-brand-violet/30 bg-brand-soft"
                : "border-line bg-white"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span className="font-medium text-ink">
                {m.sender_type === "admin" ? "LinkLazy Support" : m.sender_name}
              </span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink">{m.body}</p>
          </div>
        ))}
        {!messages?.length && <p className="text-muted">No messages.</p>}
      </div>

      {ticket.status === "closed" && (
        <p className="mb-3 text-xs text-muted">
          This ticket is closed. Sending a reply will automatically reopen it.
        </p>
      )}
      <DashboardTicketReplyForm ticketId={ticket.id} />
    </div>
  );
}
