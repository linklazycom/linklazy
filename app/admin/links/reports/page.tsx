import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminReportActions } from "@/components/admin/links/admin-report-actions";
import { shortUrlFor } from "@/lib/links/server";

export const metadata = { title: "Admin · Link abuse reports" };

export default async function AdminLinkReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: s } = await searchParams;
  const status = ["open", "actioned", "dismissed"].includes(s ?? "") ? (s as string) : "open";
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("link_reports")
    .select("id, link_id, slug, reason, details, reporter_email, status, admin_note, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  const linkIds = Array.from(new Set((reports ?? []).map((r) => r.link_id).filter((v): v is string => !!v)));
  const { data: links } = linkIds.length
    ? await supabase.from("short_links").select("id, user_id, destination_url, disabled_reason").in("id", linkIds)
    : { data: [] as { id: string; user_id: string; destination_url: string; disabled_reason: string | null }[] };
  const linkMap = new Map((links ?? []).map((l) => [l.id, l]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium">Link abuse reports</h1>
        <div className="flex gap-2 text-sm">
          {["open", "actioned", "dismissed"].map((st) => (
            <Link key={st} href={`/admin/links/reports?status=${st}`} className={`rounded-chip border px-3 py-1.5 ${st === status ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper"}`}>
              {st}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {(reports ?? []).map((r) => {
          const link = r.link_id ? linkMap.get(r.link_id) : undefined;
          return (
            <div key={r.id} className="rounded-chip border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{r.reason}</span>
                    <span className="font-mono">{shortUrlFor(r.slug)}</span>
                  </p>
                  {link ? (
                    <p className="mt-1 break-all text-xs text-muted">
                      → {link.destination_url} {link.disabled_reason ? "(already disabled)" : ""} · owner{" "}
                      <Link href={`/admin/users/${link.user_id}`} className="underline">
                        view
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">The link no longer exists.</p>
                  )}
                  {r.details && <p className="mt-2 whitespace-pre-wrap">{r.details}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {new Date(r.created_at).toLocaleString()}
                    {r.reporter_email ? ` · ${r.reporter_email}` : ""}
                    {r.admin_note ? ` · note: ${r.admin_note}` : ""}
                  </p>
                </div>
                {r.status === "open" && <AdminReportActions id={r.id} hasLink={!!link} />}
              </div>
            </div>
          );
        })}
        {!reports?.length && <p className="text-muted">No {status} reports.</p>}
      </div>
    </div>
  );
}
