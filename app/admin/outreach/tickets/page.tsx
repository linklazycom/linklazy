import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TICKET_KINDS, TICKET_KIND_LABELS, TICKET_STATUSES, TICKET_STATUS_LABELS, isTicketKind, isTicketStatus } from "@/lib/outreach/reply";

export const metadata = { title: "Admin · Outreach replies" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  followup: "bg-amber-100 text-amber-800",
  interested: "bg-green-100 text-green-800",
  order: "bg-green-200 text-green-900",
  closed: "bg-gray-200 text-gray-700",
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminOutreachTicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const statusRaw = first(sp.status);
  const kindRaw = first(sp.kind);
  const status = isTicketStatus(statusRaw) ? statusRaw : "";
  const kind = isTicketKind(kindRaw) ? kindRaw : "";
  const open = first(sp.show) !== "all" && !status; // by default closed tickets are hidden
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(first(sp.page))) || 1));

  const supabase = await createClient();
  let q = supabase
    .from("outreach_tickets")
    .select("id, email, subject, status, kind, reply_count, last_reply_at, last_reply_preview, outreach_campaigns(name)", { count: "exact" })
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) q = q.eq("status", status);
  else if (open) q = q.neq("status", "closed");
  if (kind) q = q.eq("kind", kind);

  const [{ data, count, error }, newCount] = await Promise.all([
    q,
    supabase.from("outreach_tickets").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if (error) throw new Error("Could not load tickets. Has SQL 052 been run?");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (status) s.set("status", status);
    if (kind) s.set("kind", kind);
    if (first(sp.show) === "all") s.set("show", "all");
    if (p > 1) s.set("page", String(p));
    const t = s.toString();
    return `/admin/outreach/tickets${t ? `?${t}` : ""}`;
  };

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <div>
        <h1 className="font-display text-2xl font-medium">Replies ({total}{open ? " open" : ""}) · {newCount.count ?? 0} new</h1>
        <p className="text-sm text-muted">Everyone who answered an outreach email. A person who replied is never emailed again by any campaign. Answer them from your Saleshandy inbox (the ticket shows the conversation id); come back here to set the status and keep notes.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-chip border border-line bg-white p-3 text-sm">
        <select name="status" defaultValue={status} aria-label="Status" className="rounded-chip border border-line px-2 py-1">
          <option value="">Open tickets</option>
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="kind" defaultValue={kind} aria-label="Kind" className="rounded-chip border border-line px-2 py-1">
          <option value="">Any kind</option>
          {TICKET_KINDS.map((k) => <option key={k} value={k}>{TICKET_KIND_LABELS[k]}</option>)}
        </select>
        <button type="submit" className="rounded-chip border border-line px-3 py-1">Filter</button>
        <Link href="/admin/outreach/tickets" className="px-2 py-1 text-muted underline">Reset</Link>
      </form>

      {(data ?? []).length === 0 ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">No tickets match. Replies appear here when Saleshandy&apos;s webhook reports them.</p>
      ) : (
        <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
          {(data ?? []).map((t) => {
            const camp = t.outreach_campaigns as unknown as { name?: string } | { name?: string }[] | null;
            const campName = Array.isArray(camp) ? camp[0]?.name : camp?.name;
            return (
              <li key={t.id as string} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/outreach/tickets/${t.id}`} className="font-medium underline">{t.email as string}</Link>
                  <span className="flex items-center gap-2">
                    {t.kind !== "reply" && isTicketKind(t.kind) && <span className="rounded-chip bg-gray-100 px-2 py-0.5 text-xs">{TICKET_KIND_LABELS[t.kind]}</span>}
                    <span className={`rounded-chip px-2 py-0.5 text-xs ${STATUS_STYLE[t.status as string] ?? ""}`}>{isTicketStatus(t.status) ? TICKET_STATUS_LABELS[t.status] : (t.status as string)}</span>
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {campName ?? "—"} · {t.reply_count as number} repl{t.reply_count === 1 ? "y" : "ies"} · {String(t.last_reply_at ?? "").slice(0, 16).replace("T", " ")}
                </p>
                {t.last_reply_preview ? <p className="mt-1 text-sm">{t.last_reply_preview as string}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={href(page - 1)} className="underline">← Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="underline">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
