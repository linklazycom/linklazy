import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFlags } from "@/lib/feature-flags";
import { StatCard } from "@/components/admin/stat-card";
import { daysAgoIso, personLabel, shortDate, uniqueIds, type PersonRow } from "@/lib/admin-seo";

export const metadata = { title: "Admin · Projects" };
export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const [flags, totalRes, week, month, kwRes, rowsRes] = await Promise.all([
    getFlags(["feature_tool_projects"]),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(7)),
    supabase.from("projects").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(30)),
    supabase.from("project_keywords").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id, user_id, name, domain, niche, country, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  if (rowsRes.error) throw new Error("Could not load projects.");

  const rows = rowsRes.data ?? [];
  const owners = new Set(rows.map((r) => r.user_id as string)).size;
  const withNiche = rows.filter((r) => (r.niche as string | null)?.trim()).length;
  const niches = new Map<string, number>();
  for (const r of rows) {
    const n = ((r.niche as string | null) ?? "").trim().toLowerCase();
    if (n) niches.set(n, (niches.get(n) ?? 0) + 1);
  }
  const topNiches = [...niches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const recent = rows.slice(0, 25);
  const ownerIds = uniqueIds(recent.map((r) => r.user_id as string));
  const { data: peopleRows } = ownerIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds) : { data: [] as PersonRow[] };
  const people = new Map(((peopleRows ?? []) as PersonRow[]).map((p) => [p.id, p]));
  const on = flags.feature_tool_projects !== false;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Projects</h1>
        <p className="text-sm text-muted">ব্যবহারকারীরা নিজের ওয়েবসাইটকে “প্রজেক্ট” হিসেবে যোগ করে (ঠিকানা, niche, কিওয়ার্ড, প্রতিযোগী)। Opportunity Finder, Backlink monitor ও AI Content Studio এই তথ্য ব্যবহার করে। এখানে শুধু দেখা যায়; প্রজেক্ট ব্যবহারকারীর নিজের।</p>
      </div>
      <p className={`rounded-chip p-3 text-sm ${on ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>{on ? "✅ টুলটি চালু আছে।" : "⚠️ টুলটি বন্ধ আছে।"} ON/OFF করতে <Link href="/admin/features" className="underline">Tools &amp; features</Link>।</p>

      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="All projects" value={totalRes.count ?? 0} />
        <StatCard label="New in 7 days" value={week.count ?? 0} />
        <StatCard label="New in 30 days" value={month.count ?? 0} />
        <StatCard label="Keywords saved" value={kwRes.count ?? 0} />
        <StatCard label="Users with a project" value={owners} hint={rows.length >= 1000 ? "সর্বশেষ ১,০০০ প্রজেক্ট ধরে" : undefined} />
        <StatCard label="Projects with a niche" value={withNiche} hint="niche না থাকলে Opportunity Finder ভালো কাজ করে না" />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">জনপ্রিয় niche</h2>
        {topNiches.length === 0 ? <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">এখনো কোনো niche লেখা হয়নি।</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">{topNiches.map(([n, c]) => <li key={n} className="rounded-chip border border-line bg-white px-3 py-1">{n} · {c}</li>)}</ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সর্বশেষ প্রজেক্ট</h2>
        {recent.length === 0 ? <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">এখনো কোনো প্রজেক্ট নেই।</p> : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-2">Project</th><th className="p-2">Domain</th><th className="p-2">Niche</th><th className="p-2">Country</th><th className="p-2">Owner</th><th className="p-2">Created</th></tr></thead>
              <tbody className="divide-y divide-line">
                {recent.map((r) => (
                  <tr key={r.id as string}>
                    <td className="p-2">{r.name as string}</td>
                    <td className="p-2">{r.domain as string}</td>
                    <td className="p-2">{(r.niche as string) || "—"}</td>
                    <td className="p-2">{(r.country as string) || "—"}</td>
                    <td className="p-2">{personLabel(r.user_id as string, people)}</td>
                    <td className="p-2 whitespace-nowrap">{shortDate(r.created_at)}</td>
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
