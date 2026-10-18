import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BacklinkEditForm } from "@/components/backlinks/backlink-edit-form";
import { CheckNowButton, DeleteBacklinkButton } from "@/components/backlinks/backlink-actions";
import { LinkTypeChips, StatusBadge } from "@/components/backlinks/status-badge";
import { reasonText } from "@/lib/backlinks/labels";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import { CHECK_COLUMNS } from "@/lib/backlinks/service";

export const metadata = { title: "Backlink" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "never");

export default async function BacklinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!(await isBacklinkMonitorOn())) {
    return <p className="max-w-3xl rounded-chip border border-line bg-white p-4 text-sm text-muted">Backlink monitoring is currently turned off. Please check back later.</p>;
  }

  const { data: b } = await supabase.from("backlinks").select("*").eq("id", id).maybeSingle();
  // Admins can read every backlink through RLS, but this page is the owner's workspace.
  if (!b || b.user_id !== user.id) notFound();

  const [{ data: checks }, { data: projects }] = await Promise.all([
    supabase.from("backlink_checks").select(CHECK_COLUMNS).eq("backlink_id", id).order("checked_at", { ascending: false }).limit(30),
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(200),
  ]);
  const project = (projects ?? []).find((p) => p.id === b.project_id);
  const latest = (checks ?? [])[0];
  const sawLink = b.status === "active" || b.status === "needs_review" || b.status === "not_found";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/dashboard/backlinks" className="text-sm text-muted underline">
          ← All backlinks
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          <LinkTypeChips rel={b.rel} isFollow={b.is_follow} pageRobots={b.page_robots} />
          {project && (
            <Link href={`/dashboard/projects/${project.id}`} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-violet">
              🗂 {project.name}
            </Link>
          )}
        </div>
        <a href={b.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 block break-all font-mono text-sm text-brand-violet underline">
          {b.source_url}
        </a>
        <p className="break-all font-mono text-sm text-muted">→ {b.target_url}</p>
        <div className="mt-3">
          <CheckNowButton id={b.id} />
        </div>
      </div>

      <section className="space-y-3 rounded-chip border border-line bg-white p-5 text-sm">
        <h2 className="font-display text-lg font-medium">What we saw</h2>
        {b.last_checked_at ? (
          <>
            <p>{reasonText(b.reason) || "No details."}</p>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Last checked</dt>
                <dd>{fmt(b.last_checked_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Last time the link was active</dt>
                <dd>{fmt(b.last_found_at)}</dd>
              </div>
              {sawLink && b.found_href && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">{b.status === "needs_review" ? "The page links to" : "Link address on the page"}</dt>
                  <dd className="break-all font-mono text-xs">{b.found_href}</dd>
                </div>
              )}
              {sawLink && b.found_anchor && (
                <div>
                  <dt className="text-xs text-muted">Anchor text on the page</dt>
                  <dd>{b.found_anchor}</dd>
                </div>
              )}
              {b.anchor_text && (
                <div>
                  <dt className="text-xs text-muted">Anchor text you expected</dt>
                  <dd>{b.anchor_text}</dd>
                </div>
              )}
              {b.status === "active" && (
                <div>
                  <dt className="text-xs text-muted">Matching links on the page</dt>
                  <dd>{b.match_count}</dd>
                </div>
              )}
              {b.page_robots && (
                <div>
                  <dt className="text-xs text-muted">Page-level robots setting</dt>
                  <dd className="font-mono text-xs">{b.page_robots}</dd>
                </div>
              )}
            </dl>
            {(b.status === "unavailable" || b.status === "check_failed") && <p className="text-xs text-muted">The details above are from the last time we could read the page.</p>}
            {latest?.evidence && (
              <div>
                <p className="mb-1 text-xs text-muted">HTML evidence from the last check</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-chip bg-paper p-3 font-mono text-xs">{latest.evidence}</pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted">Not checked yet. Press &quot;Check now&quot;, or wait for the next daily check.</p>
        )}
        <p className="text-xs text-muted">This shows only what the page&apos;s HTML contained. It doesn&apos;t tell you whether search engines count the link or what it is worth.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Settings</h2>
        <BacklinkEditForm id={b.id} initial={{ project_id: b.project_id, anchor_text: b.anchor_text, note: b.note, monitoring: b.monitoring }} projects={projects ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Check history</h2>
        {!checks?.length ? (
          <p className="text-sm text-muted">No checks yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <LinkTypeChips rel={c.rel} isFollow={c.is_follow} pageRobots={null} />
                    <span className="text-xs text-muted">{c.trigger === "scheduled" ? "daily check" : "manual check"}</span>
                  </div>
                  {c.status !== "active" && reasonText(c.reason) && <p className="text-xs text-muted">{reasonText(c.reason)}</p>}
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{fmt(c.checked_at)}</p>
                  {c.http_status ? <p>HTTP {c.http_status}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">The newest 30 checks are kept.</p>
      </section>

      <section className="space-y-2 border-t border-line pt-6">
        <h2 className="font-display text-lg font-medium">Stop tracking</h2>
        <p className="text-sm text-muted">Removes this backlink and its check history. The page itself is not affected.</p>
        <DeleteBacklinkButton id={b.id} />
      </section>
    </div>
  );
}
