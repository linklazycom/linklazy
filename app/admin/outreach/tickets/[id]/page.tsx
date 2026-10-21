import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketActions } from "@/components/admin/outreach/ticket-actions";
import { TICKET_KIND_LABELS, isTicketKind } from "@/lib/outreach/reply";

export const metadata = { title: "Admin · Reply ticket" };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOutreachTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("outreach_tickets")
    .select("id, contact_id, email, subject, conversation_id, status, kind, reply_count, created_at, outreach_campaigns(name)")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: contact }, { data: suppressed }] = await Promise.all([
    supabase.from("outreach_ticket_messages").select("id, kind, body, created_at").eq("ticket_id", id).order("created_at", { ascending: true }).limit(200),
    supabase.from("outreach_contacts").select("full_name, company, website, country, status").eq("id", ticket.contact_id as string).maybeSingle(),
    supabase.from("outreach_suppressions").select("id").eq("email", ticket.email as string).maybeSingle(),
  ]);

  const camp = ticket.outreach_campaigns as unknown as { name?: string } | { name?: string }[] | null;
  const campName = Array.isArray(camp) ? camp[0]?.name : camp?.name;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/outreach/tickets" className="text-sm text-muted underline">← Replies</Link>
      <div>
        <h1 className="font-display text-2xl font-medium">{ticket.email as string}</h1>
        <p className="text-sm text-muted">
          {[contact?.full_name, contact?.company, contact?.country].filter(Boolean).join(" · ") || "No other details"}
          {contact?.website ? <> · <span>{contact.website as string}</span></> : null}
        </p>
        <p className="text-xs text-muted">
          Campaign: {campName ?? "—"} · {ticket.reply_count as number} repl{ticket.reply_count === 1 ? "y" : "ies"}
          {ticket.subject ? ` · subject: ${ticket.subject as string}` : ""}
          {isTicketKind(ticket.kind) && ticket.kind !== "reply" ? ` · looks like: ${TICKET_KIND_LABELS[ticket.kind]} (a guess)` : ""}
        </p>
        {ticket.conversation_id ? (
          <p className="text-xs text-muted">Saleshandy conversation id: <code>{ticket.conversation_id as string}</code> — open your Saleshandy inbox and search for this person to answer.</p>
        ) : null}
        {suppressed && <p className="mt-1 text-xs text-red-700">This address is on the do-not-email list.</p>}
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Conversation</h2>
        <ul className="space-y-2">
          {(messages ?? []).map((m) => (
            <li key={m.id as string} className={`rounded-chip border border-line p-3 text-sm ${m.kind === "note" ? "bg-amber-50" : "bg-white"}`}>
              <p className="text-xs text-muted">{m.kind === "note" ? "Your note" : "Their reply"} · {String(m.created_at).slice(0, 16).replace("T", " ")}</p>
              <p className="mt-1 whitespace-pre-wrap">{(m.body as string) || "(Saleshandy did not include the text — read it in your Saleshandy inbox.)"}</p>
            </li>
          ))}
        </ul>
      </section>

      <TicketActions id={id} status={ticket.status as string} canStop={!suppressed} />
    </div>
  );
}
