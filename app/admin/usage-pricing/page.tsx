import { createClient } from "@/lib/supabase/server";
import { AdminUsagePricingForm } from "@/components/admin/usage/admin-usage-pricing-form";
import { RefundChargeButton } from "@/components/admin/usage/refund-charge-button";
import { USAGE_ACTIONS } from "@/lib/usage/actions";
import { getUsagePricing } from "@/lib/usage/server";

export const metadata = { title: "Admin · Usage pricing" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "");

export default async function AdminUsagePricingPage() {
  const supabase = await createClient();
  const pricing = await getUsagePricing();

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 30);
  const since = sinceDate.toISOString();
  const [{ data: recent }, { data: last30 }] = await Promise.all([
    supabase.from("usage_charges").select("id, user_id, action, amount, status, created_at, refunded_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("usage_charges").select("action, amount, status").gte("created_at", since).limit(20000),
  ]);

  const stats = new Map<string, { charged: number; chargedAmount: number; free: number; refunded: number; refundedAmount: number }>();
  for (const r of last30 ?? []) {
    const s = stats.get(r.action) ?? { charged: 0, chargedAmount: 0, free: 0, refunded: 0, refundedAmount: 0 };
    if (r.status === "charged") {
      s.charged++;
      s.chargedAmount += r.amount;
    } else if (r.status === "free") s.free++;
    else if (r.status === "refunded") {
      s.refunded++;
      s.refundedAmount += r.amount;
    }
    stats.set(r.action, s);
  }

  const ids = Array.from(new Set((recent ?? []).map((r) => r.user_id)));
  const { data: users } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  const label = (id: string) => USAGE_ACTIONS.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Usage pricing</h1>
        <p className="text-sm text-muted">
          Pay-per-use charges from the user&apos;s wallet. Everything is free until you switch charging on and set a price. To choose sensible prices, look at what the AI/API calls actually cost you (Admin &gt; API providers usage) first.
        </p>
      </div>

      <AdminUsagePricingForm
        enabled={pricing.enabled}
        actions={USAGE_ACTIONS.map((a) => ({ id: a.id, label: a.label, unit: a.unit, price: pricing.actions[a.id].price, freePerDay: pricing.actions[a.id].freePerDay }))}
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Last 30 days</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {USAGE_ACTIONS.map((a) => {
            const s = stats.get(a.id) ?? { charged: 0, chargedAmount: 0, free: 0, refunded: 0, refundedAmount: 0 };
            return (
              <div key={a.id} className="rounded-chip border border-line bg-white p-4 text-sm">
                <p className="font-medium">{a.label}</p>
                <p className="mt-2 text-muted">
                  Paid uses: <b className="text-ink">{s.charged}</b> (৳{s.chargedAmount})
                </p>
                <p className="text-muted">
                  Free uses: <b className="text-ink">{s.free}</b>
                </p>
                <p className="text-muted">
                  Refunded: <b className="text-ink">{s.refunded}</b> (৳{s.refundedAmount})
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Recent charges</h2>
        <p className="text-xs text-muted">If a user says they paid but got nothing, find the row and press Refund. A refund can be pressed twice safely: the money goes back once. Every refund appears in the wallet ledger and in the admin log.</p>
        {!recent?.length ? (
          <p className="text-sm text-muted">No usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-chip border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((r) => {
                  const u = userMap.get(r.user_id);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">{u?.full_name || u?.email || r.user_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{label(r.action)}</td>
                      <td className="px-3 py-2">৳{r.amount}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2 text-right">{r.status === "charged" ? <RefundChargeButton id={r.id} amount={r.amount} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
