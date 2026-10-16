import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/ui/pagination";
import { AdminLinkActions } from "@/components/admin/links/admin-link-actions";
import { AdminLinkSettingsForm } from "@/components/admin/links/admin-link-settings-form";
import { linkStatus } from "@/lib/links/rules";
import { safeSearchTerm } from "@/lib/links/fields";
import { LINK_LIMIT_DEFS } from "@/lib/links/limits";
import { getLinkLimits, shortUrlFor } from "@/lib/links/server";

export const metadata = { title: "Admin · Short links" };
const PAGE_SIZE = 25;

export default async function AdminLinksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const q = safeSearchTerm(sp.q);
  const status = ["disabled", "reported"].includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = supabase
    .from("short_links")
    .select("id, user_id, slug, destination_url, title, is_active, expires_at, max_clicks, click_count, disabled_reason, disabled_note, created_at", { count: "exact" });
  if (q) query = query.or(`slug.ilike.%${q}%,destination_url.ilike.%${q}%,title.ilike.%${q}%`);
  if (status === "disabled") query = query.not("disabled_reason", "is", null);

  const from = (page - 1) * PAGE_SIZE;
  const [{ data: links, count }, { count: totalLinks }, { count: disabledCount }, { count: openReports }, limits] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("short_links").select("id", { count: "exact", head: true }),
    supabase.from("short_links").select("id", { count: "exact", head: true }).not("disabled_reason", "is", null),
    supabase.from("link_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    getLinkLimits(),
  ]);

  const { data: usage } = await supabase.rpc("link_usage_stats");
  const u = (usage ?? null) as null | { clicks_total: number; clicks_24h: number; clicks_7d: number; bio_pages: number; bio_published: number; bio_views: number; bio_link_clicks: number };

  const ownerIds = Array.from(new Set((links ?? []).map((l) => l.user_id)));
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium">Short links</h1>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-chip border border-line bg-white px-3 py-2">Total links: <b>{totalLinks ?? 0}</b></span>
        <span className="rounded-chip border border-line bg-white px-3 py-2">Disabled: <b>{disabledCount ?? 0}</b></span>
        <Link href="/admin/links/reports" className="rounded-chip border border-line bg-white px-3 py-2 hover:bg-paper">
          Open abuse reports: <b className={openReports ? "text-red-600" : ""}>{openReports ?? 0}</b>
        </Link>
        <Link href="/admin/links/blocklist" className="rounded-chip border border-line bg-white px-3 py-2 hover:bg-paper">
          Blocklist →
        </Link>
      </div>

      {u && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-chip border border-line bg-white px-3 py-2">Clicks (all time): <b>{u.clicks_total}</b></span>
          <span className="rounded-chip border border-line bg-white px-3 py-2">Last 24h: <b>{u.clicks_24h}</b></span>
          <span className="rounded-chip border border-line bg-white px-3 py-2">Last 7 days: <b>{u.clicks_7d}</b></span>
          <Link href="/admin/bio" className="rounded-chip border border-line bg-white px-3 py-2 hover:bg-paper">
            Bio pages: <b>{u.bio_published}</b> published / {u.bio_pages} · {u.bio_views} views · {u.bio_link_clicks} link clicks
          </Link>
        </div>
      )}

      <AdminLinkSettingsForm fields={LINK_LIMIT_DEFS.map((d) => ({ key: d.key, label: d.label, value: limits[d.key], min: d.min, max: d.max }))} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input name="q" defaultValue={q} placeholder="Search slug, title or URL" className="w-64 rounded-chip border border-line bg-white px-3 py-2 text-sm" />
        <select name="status" defaultValue={status ?? ""} className="rounded-chip border border-line bg-white px-3 py-2 text-sm">
          <option value="">All links</option>
          <option value="disabled">Disabled only</option>
        </select>
        <button className="rounded-chip border border-line bg-white px-3 py-2 text-sm hover:bg-paper" type="submit">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {(links ?? []).map((l) => {
          const st = linkStatus(l);
          const owner = ownerMap.get(l.user_id);
          return (
            <div key={l.id} className="rounded-chip border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="font-mono">{shortUrlFor(l.slug)}</span>{" "}
                    <span className="ml-1 rounded-full bg-line/60 px-2 py-0.5 text-xs">{st.replace("_", " ")}</span>
                  </p>
                  <p className="mt-1 break-all text-xs text-muted">→ {l.destination_url}</p>
                  <p className="mt-1 text-xs text-muted">
                    Owner:{" "}
                    <Link href={`/admin/users/${l.user_id}`} className="underline">
                      {owner?.email ?? owner?.full_name ?? l.user_id}
                    </Link>{" "}
                    · {l.click_count} clicks · created {new Date(l.created_at).toLocaleDateString()}
                  </p>
                  {l.disabled_note && <p className="mt-1 text-xs text-red-700">Note: {l.disabled_note}</p>}
                </div>
                <AdminLinkActions id={l.id} disabledReason={l.disabled_reason} />
              </div>
            </div>
          );
        })}
        {!links?.length && <p className="text-muted">No links found.</p>}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/links" params={{ q: q || undefined, status }} />
    </div>
  );
}
