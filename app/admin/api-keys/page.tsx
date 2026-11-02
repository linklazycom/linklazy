import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { getFlags } from "@/lib/feature-flags";
import { getLinkLimits } from "@/lib/links/server";
import { StatCard } from "@/components/admin/stat-card";
import { AdminApiKeyActions } from "@/components/admin/api-keys/admin-api-key-actions";
import { daysAgoIso, shortDate } from "@/lib/admin-seo";
import { keyIsUsable } from "@/lib/api/keys";
import { safeSearchTerm } from "@/lib/links/fields";

export const metadata = { title: "Admin · API keys" };
export const dynamic = "force-dynamic";

type KeyRow = { id: string; user_id: string; name: string; key_prefix: string; scopes: string[]; last_used_at: string | null; expires_at: string | null; revoked_at: string | null; created_at: string };
const COLUMNS = "id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at";

export default async function AdminApiKeysPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // The api_keys table has no read policy for anyone (only the server can read it), so this page checks the admin itself.
  const admin = await requireAdmin();
  if ("error" in admin) redirect("/dashboard");
  const q = safeSearchTerm((await searchParams).q);

  const svc = createServiceClient();
  const [flags, limits, keysRes] = await Promise.all([
    getFlags(["feature_tool_api_keys"]),
    getLinkLimits(),
    svc.from("api_keys").select(COLUMNS).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (keysRes.error) throw new Error("Could not load API keys.");
  const all = (keysRes.data ?? []) as KeyRow[];

  const ownerIds = Array.from(new Set(all.map((k) => k.user_id)));
  const { data: ownersData } = ownerIds.length ? await svc.from("profiles").select("id, full_name, email").in("id", ownerIds.slice(0, 500)) : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const owners = new Map((ownersData ?? []).map((o) => [o.id, o]));
  const label = (id: string) => {
    const o = owners.get(id);
    return o?.email || o?.full_name || id.slice(0, 8);
  };

  const usable = all.filter((k) => keyIsUsable(k));
  const week = daysAgoIso(7);
  const day = daysAgoIso(1);
  const usedDay = usable.filter((k) => k.last_used_at && k.last_used_at >= day).length;
  const usedWeek = usable.filter((k) => k.last_used_at && k.last_used_at >= week).length;
  const neverUsed = usable.filter((k) => !k.last_used_at).length;
  const writers = usable.filter((k) => k.scopes.includes("links:write")).length;
  const on = flags.feature_tool_api_keys !== false;

  const matches = (k: KeyRow) => !q || `${label(k.user_id)} ${k.name} ${k.key_prefix}`.toLowerCase().includes(q.toLowerCase());
  const active = usable.filter(matches).slice(0, 100);
  const ended = all.filter((k) => !keyIsUsable(k)).filter(matches).slice(0, 25);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">API keys</h1>
        <p className="text-sm text-muted">ব্যবহারকারীদের তৈরি API কী-এর তালিকা। কী-এর আসল মান কোথাও জমা থাকে না (শুধু হ্যাশ), তাই এখানে শুধু প্রথম কয়েকটি অক্ষর, মালিক, ক্ষমতা (scope) ও শেষ ব্যবহার দেখা যায়। অপব্যবহার হলে Revoke করুন: কী সঙ্গে সঙ্গে অকেজো হয় ও মালিক ইমেইল পান; বাতিল কী আর চালু করা যায় না।</p>
      </div>
      <p className={`rounded-chip p-3 text-sm ${on ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>{on ? "✅ টুলটি চালু আছে।" : "⚠️ টুলটি বন্ধ আছে (নতুন কী বানানো যায় না; আগের কী চলতে থাকে)।"} ON/OFF করতে <Link href="/admin/features" className="underline">Tools &amp; features</Link>। প্রতি কী প্রতি মিনিটে সর্বোচ্চ {limits.api_rate_per_minute}টি অনুরোধ করতে পারে (Admin → Short links-এর সেটিংসে বদলায়)।</p>

      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Active keys" value={usable.length} />
        <StatCard label="Used in 24 hours" value={usedDay} />
        <StatCard label="Used in 7 days" value={usedWeek} />
        <StatCard label="Never used" value={neverUsed} hint="তৈরি হয়েছে কিন্তু একবারও চলেনি" />
        <StatCard label="With write access" value={writers} hint="links:write স্কোপ আছে" />
        <StatCard label="Revoked or expired" value={all.length - usable.length} />
      </section>

      <form method="get" className="flex gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="ইমেইল, নাম বা কী-এর শুরু" className="w-72 rounded-chip border border-line bg-white px-3 py-2" />
        <button type="submit" className="rounded-chip border border-line bg-white px-3 py-2">Search</button>
        {q && <Link href="/admin/api-keys" className="px-2 py-2 underline">Clear</Link>}
      </form>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">সক্রিয় কী{all.length >= 1000 ? " (সর্বশেষ ১,০০০টির মধ্যে)" : ""}</h2>
        {active.length === 0 ? <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">{q ? "কিছু পাওয়া যায়নি।" : "এখনো কোনো সক্রিয় কী নেই।"}</p> : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-2">Owner</th><th className="p-2">Name</th><th className="p-2">Key starts with</th><th className="p-2">Scopes</th><th className="p-2">Last used</th><th className="p-2">Created</th><th className="p-2"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {active.map((k) => (
                  <tr key={k.id}>
                    <td className="p-2">{label(k.user_id)}</td>
                    <td className="p-2">{k.name}</td>
                    <td className="p-2 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="p-2 text-xs">{k.scopes.join(", ")}</td>
                    <td className="p-2 whitespace-nowrap">{k.last_used_at ? shortDate(k.last_used_at) : "never"}</td>
                    <td className="p-2 whitespace-nowrap">{shortDate(k.created_at)}{k.expires_at ? ` · expires ${shortDate(k.expires_at)}` : ""}</td>
                    <td className="p-2"><AdminApiKeyActions id={k.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ended.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">বাতিল বা মেয়াদ-শেষ (সর্বশেষ ২৫টি)</h2>
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-2">Owner</th><th className="p-2">Name</th><th className="p-2">Key starts with</th><th className="p-2">Last used</th><th className="p-2">State</th></tr></thead>
              <tbody className="divide-y divide-line">
                {ended.map((k) => (
                  <tr key={k.id}>
                    <td className="p-2">{label(k.user_id)}</td>
                    <td className="p-2">{k.name}</td>
                    <td className="p-2 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="p-2 whitespace-nowrap">{k.last_used_at ? shortDate(k.last_used_at) : "never"}</td>
                    <td className="p-2 whitespace-nowrap">{k.revoked_at ? `Revoked ${shortDate(k.revoked_at)}` : `Expired ${shortDate(k.expires_at)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
