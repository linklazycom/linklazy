import { createServiceClient } from "@/lib/supabase/service";
import { MetricChip } from "@/components/ui/metric-chip";

interface Row {
  user_id: string;
  wallet_balance: number;
  ledger_sum: number;
  difference: number;
  entries: number;
  last_entry_at: string | null;
}

/**
 * Wallet reconciliation: every user's wallet_balance should equal the sum of
 * their ledger rows. Rows listed here do not match (for example money that
 * moved without a ledger entry, or data from before the ledger existed).
 * The page is read-only; fixes are made deliberately with the admin wallet tool.
 * Access is limited to admins by app/admin/layout.tsx; reads use the server client.
 */
export default async function AdminReconciliationPage() {
  const service = createServiceClient();

  const [{ count: checked }, { data: mismatches }] = await Promise.all([
    service.from("wallet_reconciliation").select("user_id", { count: "exact", head: true }),
    service
      .from("wallet_reconciliation")
      .select("user_id, wallet_balance, ledger_sum, difference, entries, last_entry_at")
      .neq("difference", 0)
      .limit(500),
  ]);

  const rows = ((mismatches ?? []) as Row[]).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  const net = rows.reduce((sum, r) => sum + r.difference, 0);

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Wallet reconciliation</h1>
      <p className="mb-6 text-sm text-muted">
        Compares each wallet balance with the sum of its ledger entries. A difference means money moved
        without a matching ledger row (or the data pre-dates the ledger).
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <MetricChip label="Users checked" value={checked ?? 0} />
        <MetricChip label="Mismatches" value={rows.length} tone={rows.length ? "price" : "verified"} />
        <MetricChip label="Net difference" value={net} />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">All wallets match their ledger.</p>
      ) : (
        <div className="overflow-x-auto rounded-chip border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Ledger sum</th>
                <th className="px-3 py-2">Difference</th>
                <th className="px-3 py-2">Entries</th>
                <th className="px-3 py-2">Last entry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.user_id}</td>
                  <td className="px-3 py-2">{r.wallet_balance}</td>
                  <td className="px-3 py-2">{r.ledger_sum}</td>
                  <td className="px-3 py-2 font-medium">{r.difference}</td>
                  <td className="px-3 py-2">{r.entries}</td>
                  <td className="px-3 py-2">{r.last_entry_at ? new Date(r.last_entry_at).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
