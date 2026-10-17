import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/ui/pagination";
import { AdminDomainActions } from "@/components/admin/domains/admin-domain-actions";
import { connectionMode, DOMAIN_COLUMNS } from "@/lib/domains/service";
import { safeSearchTerm } from "@/lib/links/fields";

export const metadata = { title: "Admin · Custom domains" };
const PAGE_SIZE = 25;
const STATUSES = ["pending", "verified", "active", "disabled"];

export default async function AdminDomainsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const q = safeSearchTerm(sp.q);
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = supabase.from("custom_domains").select(DOMAIN_COLUMNS, { count: "exact" });
  if (q) query = query.ilike("hostname", `%${q}%`);
  if (status) query = query.eq("status", status);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data: rows, count }, { count: waiting }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("custom_domains").select("id", { count: "exact", head: true }).eq("status", "verified"),
  ]);

  const ownerIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const { data: owners } = ownerIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds) : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const mode = connectionMode();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium">Custom domains</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-chip border border-line bg-white px-3 py-2">
          Connection mode: <b>{mode === "automatic" ? "Automatic (hosting API token set)" : "Manual (no hosting API token)"}</b>
        </span>
        <Link href="/admin/domains?status=verified" className="rounded-chip border border-line bg-white px-3 py-2 hover:bg-paper">
          Ownership confirmed, not active yet: <b>{waiting ?? 0}</b>
        </Link>
      </div>
      {mode === "manual" && (
        <p className="rounded-chip bg-amber-soft px-3 py-2 text-sm text-amber">
          Manual mode: for each domain in the &quot;Ownership confirmed&quot; list, add it to the hosting project (Vercel → Project → Settings → Domains), then press &quot;Mark active&quot;.
        </p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <input name="q" defaultValue={q} placeholder="Search domain" className="rounded-chip border border-line px-3 py-2" />
        <select name="status" defaultValue={status ?? ""} className="rounded-chip border border-line bg-white px-3 py-2">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-chip border border-line bg-white px-3 py-2 hover:bg-paper">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-chip border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Added</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No custom domains.
                </td>
              </tr>
            )}
            {(rows ?? []).map((r) => {
              const o = ownerMap.get(r.user_id);
              return (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <span className="break-all font-mono text-xs">{r.hostname}</span>
                    {r.last_error && r.status !== "active" && <div className="mt-1 max-w-xs text-xs text-muted">{r.last_error}</div>}
                    {r.disabled_note && <div className="mt-1 text-xs text-red-700">Note: {r.disabled_note}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{o?.full_name || o?.email || r.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{r.status}</td>
                  <td className="px-4 py-3 text-xs text-muted">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <AdminDomainActions id={r.id} status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/domains" params={{ q: q || undefined, status }} />
    </div>
  );
}
