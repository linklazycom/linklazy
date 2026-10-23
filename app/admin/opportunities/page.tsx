import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFlags } from "@/lib/feature-flags";
import { StatCard } from "@/components/admin/stat-card";
import { FinderPanel } from "@/components/opportunities/finder-panel";
import { OPP_TYPES, oppTypeLabel } from "@/lib/opportunities/rules";
import { OPPORTUNITY_FEATURE } from "@/lib/opportunities/server";
import { daysAgoIso, pctOf, personLabel, shortDate, uniqueIds, type PersonRow } from "@/lib/admin-seo";

export const metadata = { title: "Admin · Opportunity Finder" };
export const dynamic = "force-dynamic";

export default async function AdminOpportunitiesPage() {
  const supabase = await createClient();
  const svc = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const since30 = daysAgoIso(30);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));

  const [flags, providersRes, runsRes, totalRes, myProjects, ...typeCounts] = await Promise.all([
    getFlags([OPPORTUNITY_FEATURE]),
    svc.from("api_providers").select("id, name, adapter, enabled, priority, daily_limit, monthly_limit").eq("kind", "search").order("priority", { ascending: true }),
    supabase.from("opportunity_runs").select("id, user_id, project_id, types, queries, hits, added, updated, from_cache, ok, error, created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(1000),
    supabase.from("opportunities").select("id", { count: "exact", head: true }),
    user ? supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(50) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ...OPP_TYPES.map((t) => supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("opp_type", t.id)),
  ]);
  if (runsRes.error) throw new Error("Could not load the Opportunity Finder data. Has SQL 054 been run?");

  const featureOn = flags[OPPORTUNITY_FEATURE] !== false;
  const providers = providersRes.data ?? [];
  const enabledProviders = providers.filter((p) => p.enabled);
  const ready = featureOn && enabledProviders.length > 0;

  // Provider use today / this month (this feature only)
  const usage = await Promise.all(
    providers.map(async (p) => {
      const base = () => svc.from("api_usage_log").select("id", { count: "exact", head: true }).eq("provider_id", p.id as string).eq("feature", OPPORTUNITY_FEATURE);
      const [today, month, failedMonth] = await Promise.all([base().gte("created_at", startOfDay.toISOString()), base().gte("created_at", startOfMonth.toISOString()), base().gte("created_at", startOfMonth.toISOString()).eq("ok", false)]);
      return { id: p.id as string, today: today.count ?? 0, month: month.count ?? 0, failedMonth: failedMonth.count ?? 0 };
    })
  );
  const usageById = new Map(usage.map((u) => [u.id, u]));

  const runs = runsRes.data ?? [];
  const okRuns = runs.filter((r) => r.ok).length;
  const added = runs.reduce((s, r) => s + (Number(r.added) || 0), 0);
  const queries = runs.reduce((s, r) => s + (Number(r.queries) || 0), 0);
  const fromCache = runs.reduce((s, r) => s + (Number(r.from_cache) || 0), 0);
  const users = new Set(runs.map((r) => r.user_id as string)).size;

  const recent = runs.slice(0, 25);
  const projectIds = uniqueIds(recent.map((r) => r.project_id as string | null));
  const userIds = uniqueIds(recent.map((r) => r.user_id as string));
  const [projRes, peopleRes] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, name").in("id", projectIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [] as PersonRow[] }),
  ]);
  const projName = new Map((projRes.data ?? []).map((p) => [p.id as string, p.name as string]));
  const people = new Map(((peopleRes.data ?? []) as PersonRow[]).map((p) => [p.id, p]));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Opportunity Finder</h1>
        <p className="text-sm text-muted">
          ব্যবহারকারীরা প্রজেক্টের niche ও কিওয়ার্ড দিয়ে ওয়েবে লিংক পাওয়ার সম্ভাব্য জায়গা (গেস্ট পোস্ট, ডিরেক্টরি, রিসোর্স পেজ…) খোঁজে। এখানে আপনি দেখবেন টুলটি চালু কিনা, সার্চ প্রোভাইডার ঠিক আছে কিনা, কে কত ব্যবহার করছে, আর নিজেও চালিয়ে পরীক্ষা করতে পারবেন।
        </p>
      </div>

      <section aria-label="Status" className="space-y-2">
        <p className={`rounded-chip p-3 text-sm ${featureOn ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
          {featureOn ? "✅ টুলটি ব্যবহারকারীদের জন্য চালু আছে।" : "⚠️ টুলটি বন্ধ আছে।"} ON/OFF করতে <Link href="/admin/features" className="underline">Tools &amp; features</Link>-এ যান।
        </p>
        {enabledProviders.length === 0 ? (
          <p className="rounded-chip bg-red-50 p-3 text-sm text-red-900">❌ কোনো চালু Web search প্রোভাইডার নেই, তাই কেউ সার্চ চালাতে পারছে না। <Link href="/admin/api-providers" className="underline">API Providers</Link>-এ Tavily (বা অন্য) যোগ করে Test connection ও Enable করুন।</p>
        ) : (
          <p className="rounded-chip bg-green-50 p-3 text-sm text-green-900">✅ চালু সার্চ প্রোভাইডার: {enabledProviders.map((p) => p.name as string).join(", ")}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সার্চ প্রোভাইডার ও ব্যবহার (শুধু এই টুলের)</h2>
        {providers.length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">কোনো Web search প্রোভাইডার যোগ করা হয়নি।</p>
        ) : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Enabled</th><th className="p-2">Today</th><th className="p-2">This month</th><th className="p-2">Failed (month)</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {providers.map((p) => {
                  const u = usageById.get(p.id as string);
                  return (
                    <tr key={p.id as string}>
                      <td className="p-2">{p.name as string}</td>
                      <td className="p-2">{p.adapter as string}</td>
                      <td className="p-2">{p.enabled ? "Yes" : "No"}</td>
                      <td className="p-2">{u?.today ?? 0}{p.daily_limit !== null ? ` / ${p.daily_limit}` : ""}</td>
                      <td className="p-2">{u?.month ?? 0}{p.monthly_limit !== null ? ` / ${p.monthly_limit}` : ""}</td>
                      <td className="p-2">{u?.failedMonth ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">প্রতিটি নতুন সার্চ-বাক্য প্রোভাইডারের ১টি কোটা খরচ করে; একই বাক্য ৭ দিন ক্যাশ থাকে, তাই আগের উত্তর পুনরায় ব্যবহার হলে কোটা লাগে না। সীমা বদলাতে API Providers পেজ।</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">গত ৩০ দিন</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Search runs" value={runs.length} hint={`${okRuns} সফল · ${runs.length - okRuns} ব্যর্থ`} />
          <StatCard label="Users who searched" value={users} />
          <StatCard label="New opportunities saved" value={added} />
          <StatCard label="Answers reused from cache" value={fromCache} hint={`${pctOf(fromCache, queries)} of ${queries} searches`} />
        </div>
        {runs.length >= 1000 && <p className="text-xs text-muted">সংখ্যাগুলো সর্বশেষ ১,০০০ রান ধরে।</p>}
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="All saved opportunities" value={totalRes.count ?? 0} />
          {OPP_TYPES.map((t, i) => <StatCard key={t.id} label={t.label} value={typeCounts[i]?.count ?? 0} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">নিজে চালিয়ে দেখুন</h2>
        <p className="text-sm text-muted">আপনার নিজের অ্যাকাউন্টের একটি প্রজেক্ট দিয়ে সার্চ চলে (অ্যাডমিনের জন্য ঘণ্টার সীমা নেই)। ফলাফল দেখুন <Link href="/dashboard/opportunities" className="underline">Dashboard &gt; Opportunity Finder</Link>-এ।</p>
        <FinderPanel projects={myProjects.data ?? []} initialProject={null} ready={ready} />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সর্বশেষ রান</h2>
        {recent.length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">গত ৩০ দিনে কোনো রান নেই।</p>
        ) : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr><th className="p-2">When (UTC)</th><th className="p-2">User</th><th className="p-2">Project</th><th className="p-2">Kinds</th><th className="p-2">Searches</th><th className="p-2">Found</th><th className="p-2">New</th><th className="p-2">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((r) => (
                  <tr key={r.id as string}>
                    <td className="p-2 whitespace-nowrap">{shortDate(r.created_at)}</td>
                    <td className="p-2">{personLabel(r.user_id as string, people)}</td>
                    <td className="p-2">{r.project_id ? projName.get(r.project_id as string) ?? "—" : "(deleted)"}</td>
                    <td className="p-2">{((r.types as string[]) ?? []).map(oppTypeLabel).join(", ")}</td>
                    <td className="p-2">{r.queries as number}{Number(r.from_cache) > 0 ? ` (${r.from_cache} cached)` : ""}</td>
                    <td className="p-2">{r.hits as number}</td>
                    <td className="p-2">{r.added as number}</td>
                    <td className="p-2">{r.ok ? "OK" : <span className="text-red-700">{(r.error as string) || "Failed"}</span>}</td>
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
