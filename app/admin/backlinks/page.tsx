import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFlags } from "@/lib/feature-flags";
import { StatCard } from "@/components/admin/stat-card";
import { daysAgoIso, isOlderThan, personLabel, shortDate, uniqueIds, type PersonRow } from "@/lib/admin-seo";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/backlinks/labels";

export const metadata = { title: "Admin · Backlink monitor" };
export const dynamic = "force-dynamic";

const PROBLEM = ["not_found", "unavailable", "check_failed", "needs_review"] as const;

export default async function AdminBacklinksPage() {
  const supabase = await createClient();
  const [flags, totalRes, monitoringOff, week, checks24, failed24, lastChecked, problemRes, ...statusCounts] = await Promise.all([
    getFlags(["feature_backlink_monitor"]),
    supabase.from("backlinks").select("id", { count: "exact", head: true }),
    supabase.from("backlinks").select("id", { count: "exact", head: true }).eq("monitoring", false),
    supabase.from("backlinks").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(7)),
    supabase.from("backlink_checks").select("id", { count: "exact", head: true }).gte("checked_at", daysAgoIso(1)),
    supabase.from("backlink_checks").select("id", { count: "exact", head: true }).gte("checked_at", daysAgoIso(1)).eq("status", "check_failed"),
    supabase.from("backlinks").select("last_checked_at").not("last_checked_at", "is", null).order("last_checked_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("backlinks").select("id, user_id, source_domain, target_url, status, reason, last_checked_at, last_status_change_at").in("status", [...PROBLEM]).order("last_status_change_at", { ascending: false, nullsFirst: false }).limit(25),
    ...STATUS_ORDER.map((s) => supabase.from("backlinks").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (totalRes.error) throw new Error("Could not load backlinks.");

  const problems = problemRes.data ?? [];
  const ownerIds = uniqueIds(problems.map((r) => r.user_id as string));
  const { data: peopleRows } = ownerIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds) : { data: [] as PersonRow[] };
  const people = new Map(((peopleRows ?? []) as PersonRow[]).map((p) => [p.id, p]));

  const on = flags.feature_backlink_monitor !== false;
  const lastAt = (lastChecked.data?.last_checked_at as string | undefined) ?? null;
  const stale = isOlderThan(lastAt, 2) && (totalRes.count ?? 0) > 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Backlink monitor</h1>
        <p className="text-sm text-muted">ব্যবহারকারীরা যে ব্যাকলিংকগুলো পেয়েছে সেগুলো সিস্টেম নিয়মিত দেখে: লিংকটি এখনো পেজে আছে কিনা, follow না nofollow। এখানে সামগ্রিক অবস্থা ও সমস্যাযুক্ত লিংক দেখা যায়। ব্যবহারকারীর লিংক এখান থেকে বদলানো হয় না।</p>
      </div>
      <p className={`rounded-chip p-3 text-sm ${on ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>{on ? "✅ টুলটি চালু আছে।" : "⚠️ টুলটি বন্ধ আছে (স্বয়ংক্রিয় চেকও থামা)।"} ON/OFF করতে <Link href="/admin/features" className="underline">Tools &amp; features</Link>। ব্যাকলিংক-সংখ্যার সীমা: <Link href="/admin/links" className="underline">Admin &gt; Links</Link>।</p>
      {stale && <p className="rounded-chip bg-red-50 p-3 text-sm text-red-900">❌ সর্বশেষ চেক {shortDate(lastAt)} UTC-তে, অর্থাৎ ২ দিনের বেশি আগে। দৈনিক cron চলছে কিনা Vercel &gt; Settings &gt; Cron Jobs-এ দেখুন।</p>}

      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="All backlinks" value={totalRes.count ?? 0} hint={`${week.count ?? 0} added in 7 days`} />
        <StatCard label="Monitoring paused" value={monitoringOff.count ?? 0} />
        <StatCard label="Checks in last 24h" value={checks24.count ?? 0} hint={`${failed24.count ?? 0} could not be checked`} />
        <StatCard label="Last check" value={lastAt ? shortDate(lastAt) : "never"} hint="UTC" />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">অবস্থা অনুযায়ী</h2>
        <div className="grid gap-3 sm:grid-cols-6">
          {STATUS_ORDER.map((s, i) => <StatCard key={s} label={STATUS_LABEL[s]} value={statusCounts[i]?.count ?? 0} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">মনোযোগ দরকার (সর্বশেষ ২৫)</h2>
        {problems.length === 0 ? <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">কোনো সমস্যাযুক্ত লিংক নেই।</p> : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-2">Source</th><th className="p-2">Target</th><th className="p-2">Status</th><th className="p-2">Reason</th><th className="p-2">Owner</th><th className="p-2">Last checked</th></tr></thead>
              <tbody className="divide-y divide-line">
                {problems.map((r) => (
                  <tr key={r.id as string}>
                    <td className="p-2">{r.source_domain as string}</td>
                    <td className="max-w-[16rem] truncate p-2" title={r.target_url as string}>{r.target_url as string}</td>
                    <td className="p-2">{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? (r.status as string)}</td>
                    <td className="p-2">{(r.reason as string) || "—"}</td>
                    <td className="p-2">{personLabel(r.user_id as string, people)}</td>
                    <td className="p-2 whitespace-nowrap">{shortDate(r.last_checked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
