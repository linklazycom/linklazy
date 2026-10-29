import { createServiceClient } from "@/lib/supabase/service";
import { StatCard } from "@/components/admin/stat-card";
import { RetryTaskButton } from "@/components/admin/operations/retry-task-button";
import { summarizeUsage, taskHealth } from "@/lib/ops-summary";

export const metadata = { title: "Admin · Operations" };
export const dynamic = "force-dynamic";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export default async function AdminOperationsPage() {
  // The tasks tables have no public policies (server only), so the page reads them with the service client.
  // The admin layout already blocks non-admins.
  const svc = createServiceClient();
  const [open, failed, succeeded24, usage] = await Promise.all([
    svc.from("tasks").select("status, run_at, locked_at").in("status", ["queued", "running"]).limit(2000),
    svc.from("tasks").select("id, type, attempts, max_attempts, last_error, finished_at, created_at, user_id").eq("status", "failed").gte("created_at", daysAgo(7)).order("created_at", { ascending: false }).limit(50),
    svc.from("tasks").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("finished_at", daysAgo(1)),
    svc.from("usage_charges").select("action, amount, status").gte("created_at", daysAgo(30)).limit(20000),
  ]);

  const health = taskHealth((open.data ?? []) as { status: string; run_at: string; locked_at: string | null }[], new Date());
  const queued = (open.data ?? []).filter((t) => t.status === "queued").length;
  const usageRows = summarizeUsage((usage.data ?? []) as { action: string; amount: number; status: string }[]);

  const userIds = Array.from(new Set((failed.data ?? []).map((t) => t.user_id as string | null).filter((x): x is string => !!x)));
  const { data: people } = userIds.length ? await svc.from("profiles").select("id, full_name").in("id", userIds) : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Operations</h1>
        <p className="text-sm text-muted">ব্যাকগ্রাউন্ড কাজ (লিংক-চেক ইত্যাদি) ঠিকমতো চলছে কিনা, ব্যর্থ কাজ, আর পেইড টুলগুলোর ব্যবহার ও ফেরতের হার — এক জায়গায়।</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Queued now" value={queued} hint={health.overdueQueued > 0 ? `${health.overdueQueued} overdue (6h+)` : "none overdue"} />
        <StatCard label="Stuck running" value={health.stuckRunning} hint="locked 30+ minutes" />
        <StatCard label="Failed (7 days)" value={failed.data?.length ?? 0} />
        <StatCard label="Succeeded (24h)" value={succeeded24.count ?? 0} />
      </section>
      {(health.overdueQueued > 0 || health.stuckRunning > 0) && (
        <p className="rounded-chip bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ কিছু কাজ আটকে আছে। দৈনিক cron (run-tasks) চলছে কিনা Vercel &gt; Settings &gt; Cron Jobs-এ দেখুন; আটকে-থাকা &quot;running&quot; কাজ পরের রানে নিজে আবার কিউতে যায়।
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Failed tasks (last 7 days)</h2>
        {(failed.data ?? []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-chip border border-line bg-white p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {t.type} <span className="text-xs font-normal text-muted">· {t.attempts}/{t.max_attempts} attempts · {t.user_id ? (names.get(t.user_id as string) ?? "User") : "system"}</span>
              </p>
              <p className="break-words text-xs text-muted">{t.last_error ?? "No error text"}</p>
              <p className="text-xs text-muted">{new Date(t.finished_at ?? t.created_at).toLocaleString()}</p>
            </div>
            <RetryTaskButton id={t.id} />
          </div>
        ))}
        {!failed.data?.length && <p className="text-sm text-muted">No failed tasks. 🎉</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Paid tool usage (last 30 days)</h2>
        <p className="text-xs text-muted">
          এখানে ব্যবহারকারীর কাছ থেকে নেওয়া চার্জ দেখা যায় (আপনার আয়)। প্রোভাইডারকে আপনি কত দিচ্ছেন সেই খরচ সিস্টেমে রেকর্ড হয় না — তা প্রোভাইডারের নিজস্ব ড্যাশবোর্ডে দেখুন। ফেরতের হার বেশি মানে সেই টুল ব্যবহারকারীদের জন্য প্রায়ই ব্যর্থ হচ্ছে।
        </p>
        <div className="overflow-x-auto rounded-chip border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="p-2">Tool</th>
                <th className="p-2">Charged</th>
                <th className="p-2">Revenue (৳)</th>
                <th className="p-2">Refunded</th>
                <th className="p-2">Refund rate</th>
                <th className="p-2">Free uses</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map((r) => (
                <tr key={r.action} className="border-t border-line">
                  <td className="p-2 font-mono text-xs">{r.action}</td>
                  <td className="p-2">{r.charged}</td>
                  <td className="p-2">{r.chargedAmount.toLocaleString()}</td>
                  <td className="p-2">{r.refunded}</td>
                  <td className={`p-2 ${r.refundRate >= 20 ? "font-medium text-red-600" : ""}`}>{r.refundRate}%</td>
                  <td className="p-2">{r.free}</td>
                </tr>
              ))}
              {!usageRows.length && (
                <tr>
                  <td className="p-3 text-muted" colSpan={6}>No usage yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
