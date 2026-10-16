import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/ui/pagination";
import { AdminBioActions } from "@/components/admin/bio/admin-bio-actions";
import { safeSearchTerm } from "@/lib/links/fields";
import { siteUrl } from "@/lib/links/server";

export const metadata = { title: "Admin · Bio pages" };
const PAGE_SIZE = 25;

export default async function AdminBioPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const q = safeSearchTerm(sp.q);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("bio_pages")
    .select("id, user_id, slug, display_name, bio, is_published, view_count, disabled_reason, disabled_note, created_at", { count: "exact" });
  if (q) query = query.or(`slug.ilike.%${q}%,display_name.ilike.%${q}%`);
  const { data: pages, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const ids = (pages ?? []).map((p) => p.id);
  const ownerIds = Array.from(new Set((pages ?? []).map((p) => p.user_id)));
  const [{ data: links }, { data: owners }] = await Promise.all([
    ids.length ? supabase.from("bio_links").select("bio_id, click_count").in("bio_id", ids) : Promise.resolve({ data: [] as { bio_id: string; click_count: number }[] }),
    ownerIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);
  const linkCount = new Map<string, { n: number; clicks: number }>();
  for (const l of links ?? []) {
    const cur = linkCount.get(l.bio_id) ?? { n: 0, clicks: 0 };
    linkCount.set(l.bio_id, { n: cur.n + 1, clicks: cur.clicks + (l.click_count ?? 0) });
  }
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium">Bio pages</h1>
      <form method="get" className="flex gap-3">
        <input name="q" defaultValue={q} placeholder="Search address or name" className="w-64 rounded-chip border border-line bg-white px-3 py-2 text-sm" />
        <button className="rounded-chip border border-line bg-white px-3 py-2 text-sm hover:bg-paper" type="submit">
          Search
        </button>
      </form>

      <div className="space-y-3">
        {(pages ?? []).map((p) => {
          const owner = ownerMap.get(p.user_id);
          const lc = linkCount.get(p.id);
          return (
            <div key={p.id} className="rounded-chip border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.display_name}{" "}
                    <span className="ml-1 rounded-full bg-line/60 px-2 py-0.5 text-xs">{p.disabled_reason ? "disabled" : p.is_published ? "published" : "draft"}</span>
                  </p>
                  <a href={`${siteUrl()}/bio/${p.slug}`} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-brand-violet underline">
                    {siteUrl()}/bio/{p.slug}
                  </a>
                  {p.bio && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.bio}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Owner:{" "}
                    <Link href={`/admin/users/${p.user_id}`} className="underline">
                      {owner?.email ?? owner?.full_name ?? p.user_id}
                    </Link>{" "}
                    · {lc?.n ?? 0} links · {lc?.clicks ?? 0} link clicks · {p.view_count} views
                  </p>
                  {p.disabled_note && <p className="mt-1 text-xs text-red-700">Note: {p.disabled_note}</p>}
                </div>
                <AdminBioActions id={p.id} disabledReason={p.disabled_reason} />
              </div>
            </div>
          );
        })}
        {!pages?.length && <p className="text-muted">No bio pages found.</p>}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/bio" params={{ q: q || undefined }} />
    </div>
  );
}
