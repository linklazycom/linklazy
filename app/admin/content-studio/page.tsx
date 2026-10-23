import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFlags } from "@/lib/feature-flags";
import { StatCard } from "@/components/admin/stat-card";
import { daysAgoIso, pctOf, shortDate } from "@/lib/admin-seo";

export const metadata = { title: "Admin · AI Content Studio" };
export const dynamic = "force-dynamic";

const FEATURE = "feature_ai_content";

export default async function AdminContentStudioPage() {
  const supabase = await createClient();
  const svc = createServiceClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const usageBase = () => svc.from("api_usage_log").select("id", { count: "exact", head: true }).eq("feature", FEATURE);

  const [flags, docsTotal, docs7, docs30, docRows, providersRes, today, week, month, failedMonth, callRows, errorRows] = await Promise.all([
    getFlags([FEATURE]),
    supabase.from("content_documents").select("id", { count: "exact", head: true }),
    supabase.from("content_documents").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(7)),
    supabase.from("content_documents").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(30)),
    supabase.from("content_documents").select("user_id, kind").order("created_at", { ascending: false }).limit(1000),
    svc.from("api_providers").select("id, name, kind, adapter, enabled").in("kind", ["ai", "image"]).order("kind", { ascending: true }),
    usageBase().gte("created_at", start.toISOString()),
    usageBase().gte("created_at", daysAgoIso(7)),
    usageBase().gte("created_at", daysAgoIso(30)),
    usageBase().gte("created_at", daysAgoIso(30)).eq("ok", false),
    svc.from("api_usage_log").select("provider_name, ok, input_tokens, output_tokens").eq("feature", FEATURE).gte("created_at", daysAgoIso(30)).limit(1000),
    svc.from("api_usage_log").select("provider_name, error, created_at").eq("feature", FEATURE).eq("ok", false).order("created_at", { ascending: false }).limit(10),
  ]);
  if (docsTotal.error) throw new Error("Could not load the Content Studio data.");

  const on = flags[FEATURE] !== false;
  const providers = providersRes.data ?? [];
  const aiOn = providers.filter((p) => p.kind === "ai" && p.enabled);
  const imgOn = providers.filter((p) => p.kind === "image" && p.enabled);

  const docs = docRows.data ?? [];
  const writers = new Set(docs.map((d) => d.user_id as string)).size;
  const kinds = new Map<string, number>();
  for (const d of docs) kinds.set(d.kind as string, (kinds.get(d.kind as string) ?? 0) + 1);
  const kindList = [...kinds.entries()].sort((a, b) => b[1] - a[1]);

  const perProvider = new Map<string, { calls: number; failed: number; inTok: number; outTok: number }>();
  for (const r of callRows.data ?? []) {
    const k = (r.provider_name as string) || "—";
    const cur = perProvider.get(k) ?? { calls: 0, failed: 0, inTok: 0, outTok: 0 };
    cur.calls++;
    if (!r.ok) cur.failed++;
    cur.inTok += Number(r.input_tokens) || 0;
    cur.outTok += Number(r.output_tokens) || 0;
    perProvider.set(k, cur);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">AI Content Studio</h1>
        <p className="text-sm text-muted">ব্যবহারকারীরা AI দিয়ে আউটরিচ ইমেইল, বায়ো, আর্টিকেলের আইডিয়া/ড্রাফট ইত্যাদি লেখে। এখানে দেখবেন টুলটি চালু কিনা, AI প্রোভাইডার ঠিক আছে কিনা, কতবার ব্যবহার হলো ও কতবার ব্যর্থ হলো। ব্যবহারকারীর লেখা এখানে দেখানো হয় না।</p>
      </div>

      <section className="space-y-2">
        <p className={`rounded-chip p-3 text-sm ${on ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>{on ? "✅ টুলটি ব্যবহারকারীদের জন্য চালু আছে।" : "⚠️ টুলটি বন্ধ আছে।"} ON/OFF করতে <Link href="/admin/features" className="underline">Tools &amp; features</Link>। দাম ও ফ্রি-সংখ্যা: <Link href="/admin/usage-pricing" className="underline">Usage pricing</Link>।</p>
        {aiOn.length === 0 ? (
          <p className="rounded-chip bg-red-50 p-3 text-sm text-red-900">❌ কোনো চালু AI প্রোভাইডার নেই, তাই লেখা তৈরি হচ্ছে না। <Link href="/admin/api-providers" className="underline">API Providers</Link>-এ যোগ করে Test connection ও Enable করুন।</p>
        ) : (
          <p className="rounded-chip bg-green-50 p-3 text-sm text-green-900">✅ চালু AI প্রোভাইডার: {aiOn.map((p) => p.name as string).join(", ")}. {imgOn.length > 0 ? `ছবির প্রোভাইডার: ${imgOn.map((p) => p.name as string).join(", ")}.` : "ছবির প্রোভাইডার চালু নেই (ঐচ্ছিক)।"}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">AI কল (প্রোভাইডারে পাঠানো অনুরোধ)</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Today (UTC)" value={today.count ?? 0} />
          <StatCard label="Last 7 days" value={week.count ?? 0} />
          <StatCard label="Last 30 days" value={month.count ?? 0} />
          <StatCard label="Failed in 30 days" value={failedMonth.count ?? 0} hint={pctOf(failedMonth.count ?? 0, month.count ?? 0)} />
        </div>
        {perProvider.size > 0 && (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-2">Provider</th><th className="p-2">Calls (30d)</th><th className="p-2">Failed</th><th className="p-2">Input tokens</th><th className="p-2">Output tokens</th></tr></thead>
              <tbody className="divide-y divide-line">
                {[...perProvider.entries()].map(([name, v]) => (
                  <tr key={name}><td className="p-2">{name}</td><td className="p-2">{v.calls}</td><td className="p-2">{v.failed}</td><td className="p-2">{v.inTok || "—"}</td><td className="p-2">{v.outTok || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">এটি এই টুলের কল (প্রজেক্টের AI সাজেশনও একই সুইচে গোনা হয়)। টোকেন সংখ্যা সব প্রোভাইডার দেয় না; না দিলে “—”।</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সংরক্ষিত ডকুমেন্ট</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="All documents" value={docsTotal.count ?? 0} />
          <StatCard label="Saved in 7 days" value={docs7.count ?? 0} />
          <StatCard label="Saved in 30 days" value={docs30.count ?? 0} />
          <StatCard label="Users who saved" value={writers} hint={docs.length >= 1000 ? "সর্বশেষ ১,০০০টি ধরে" : undefined} />
        </div>
        {kindList.length > 0 && <ul className="flex flex-wrap gap-2 text-sm">{kindList.map(([k, c]) => <li key={k} className="rounded-chip border border-line bg-white px-3 py-1">{k} · {c}</li>)}</ul>}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সাম্প্রতিক ব্যর্থতা</h2>
        {(errorRows.data ?? []).length === 0 ? <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">কোনো ব্যর্থতা নেই।</p> : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(errorRows.data ?? []).map((e, i) => (
              <li key={i} className="p-3"><p className="font-medium">{(e.provider_name as string) || "—"} <span className="text-xs text-muted">· {shortDate(e.created_at)} UTC</span></p><p className="text-xs text-red-800">{(e.error as string) || "No reason recorded."}</p></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
