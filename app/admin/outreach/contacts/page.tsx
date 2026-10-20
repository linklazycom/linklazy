import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContactRowActions } from "@/components/admin/outreach/contact-row-actions";
import { HeldActions } from "@/components/admin/outreach/held-actions";
import { CONTACTS_PER_PAGE, filtersToParams, parseContactFilters } from "@/lib/outreach/filters";
import { CONTACT_SOURCES, CONTACT_STATUSES, HOLD_REASONS, HOLD_REASON_LABELS, isHoldReason } from "@/lib/outreach/rules";

export const metadata = { title: "Admin · Outreach contacts" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  held: "bg-amber-100 text-amber-800",
  unsubscribed: "bg-gray-200 text-gray-700",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-red-100 text-red-800",
  blocked: "bg-gray-200 text-gray-700",
};

export default async function AdminOutreachContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseContactFilters(await searchParams);
  const supabase = await createClient();

  let q = supabase
    .from("outreach_contacts")
    .select("id, email, full_name, company, website, country, country_source, source, status, hold_reason, is_role, tags, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * CONTACTS_PER_PAGE, f.page * CONTACTS_PER_PAGE - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.source) q = q.eq("source", f.source);
  if (f.country) q = q.eq("country", f.country);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.q) q = q.or(`email.ilike.%${f.q}%,full_name.ilike.%${f.q}%,company.ilike.%${f.q}%`);

  const [{ data, count, error }, heldCounts] = await Promise.all([
    q,
    Promise.all(
      HOLD_REASONS.map(async (r) => {
        const { count: c } = await supabase.from("outreach_contacts").select("id", { count: "exact", head: true }).eq("status", "held").eq("hold_reason", r);
        return { reason: r, count: c ?? 0 };
      })
    ),
  ]);
  if (error) throw new Error("Could not load contacts");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / CONTACTS_PER_PAGE));
  const params = filtersToParams(f);
  const href = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return `/admin/outreach/contacts${s ? `?${s}` : ""}`;
  };
  const exportHref = `/api/admin/outreach/export?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()}`;
  const sourceLabel = (id: string) => CONTACT_SOURCES.find((s) => s.id === id)?.label.split(" (")[0] ?? id;

  return (
    <div className="space-y-5">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-medium">Contacts ({total})</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/outreach/import" className="underline">Import</Link>
          <a href={exportHref} className="underline">Export CSV</a>
        </div>
      </div>

      <HeldActions groups={heldCounts.filter((g) => g.count > 0 && isHoldReason(g.reason))} />

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-chip border border-line bg-white p-3 text-sm">
        <input name="q" defaultValue={f.q ?? ""} placeholder="Search email, name, company" aria-label="Search" className="rounded-chip border border-line px-2 py-1" />
        <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className="rounded-chip border border-line px-2 py-1">
          <option value="">Any status</option>
          {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="source" defaultValue={f.source ?? ""} aria-label="Source" className="rounded-chip border border-line px-2 py-1">
          <option value="">Any source</option>
          {CONTACT_SOURCES.map((s) => <option key={s.id} value={s.id}>{sourceLabel(s.id)}</option>)}
        </select>
        <input name="country" defaultValue={f.country ?? ""} maxLength={2} placeholder="Country" aria-label="Country code" className="w-20 rounded-chip border border-line px-2 py-1" />
        <input name="tag" defaultValue={f.tag ?? ""} placeholder="Tag" aria-label="Tag" className="w-28 rounded-chip border border-line px-2 py-1" />
        <button type="submit" className="rounded-chip border border-line px-3 py-1">Filter</button>
        <Link href="/admin/outreach/contacts" className="px-2 py-1 text-muted underline">Reset</Link>
      </form>

      {(data ?? []).length === 0 ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">No contacts match.</p>
      ) : (
        <div className="overflow-x-auto rounded-chip border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="p-2">Email</th>
                <th className="p-2">Name / company</th>
                <th className="p-2">Country</th>
                <th className="p-2">Source</th>
                <th className="p-2">Status</th>
                <th className="p-2">Tags</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="p-2">
                    {c.email}
                    {c.is_role && <span className="ml-1 text-xs text-muted">(shared mailbox)</span>}
                  </td>
                  <td className="p-2">{[c.full_name, c.company].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-2">
                    {c.country ?? "—"}
                    {c.country_source === "tld" && <span className="text-xs text-muted"> (from domain)</span>}
                  </td>
                  <td className="p-2 text-xs">{sourceLabel(c.source)}</td>
                  <td className="p-2">
                    <span className={`rounded-chip px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</span>
                    {c.hold_reason && isHoldReason(c.hold_reason) && <p className="mt-1 text-xs text-muted">{HOLD_REASON_LABELS[c.hold_reason]}</p>}
                  </td>
                  <td className="p-2 text-xs">{(c.tags ?? []).join(", ") || "—"}</td>
                  <td className="p-2"><ContactRowActions id={c.id} status={c.status} tags={c.tags ?? []} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {f.page > 1 && <Link href={href(f.page - 1)} className="underline">← Previous</Link>}
          <span className="text-muted">Page {f.page} of {pages}</span>
          {f.page < pages && <Link href={href(f.page + 1)} className="underline">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
