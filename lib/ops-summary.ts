/** Pure helpers for the admin Operations page (Batch 20). Tested in tests/ops-summary.test.ts. */
export interface UsageChargeRow {
  action: string;
  amount: number;
  status: string; // charged | free | refunded | void
}

export interface UsageSummaryRow {
  action: string;
  charged: number;
  chargedAmount: number;
  refunded: number;
  refundedAmount: number;
  free: number;
  /** refunded / (charged + refunded), 0-100, one decimal. High = something keeps failing for users. */
  refundRate: number;
}

export function summarizeUsage(rows: UsageChargeRow[]): UsageSummaryRow[] {
  const map = new Map<string, UsageSummaryRow>();
  for (const r of rows) {
    const e = map.get(r.action) ?? { action: r.action, charged: 0, chargedAmount: 0, refunded: 0, refundedAmount: 0, free: 0, refundRate: 0 };
    if (r.status === "charged") {
      e.charged++;
      e.chargedAmount += Number(r.amount);
    } else if (r.status === "refunded") {
      e.refunded++;
      e.refundedAmount += Number(r.amount);
    } else if (r.status === "free") {
      e.free++;
    }
    map.set(r.action, e);
  }
  const out = [...map.values()];
  for (const e of out) {
    const paid = e.charged + e.refunded;
    e.refundRate = paid > 0 ? Math.round((e.refunded / paid) * 1000) / 10 : 0;
  }
  return out.sort((a, b) => b.chargedAmount - a.chargedAmount);
}

export interface TaskRowLite {
  status: string;
  run_at: string;
  locked_at: string | null;
}

/** queued but overdue (runner not picking it up) and running but locked for too long (runner crashed). */
export function taskHealth(rows: TaskRowLite[], now: Date, overdueHours = 6, stuckMinutes = 30) {
  let overdueQueued = 0;
  let stuckRunning = 0;
  for (const t of rows) {
    if (t.status === "queued" && now.getTime() - new Date(t.run_at).getTime() > overdueHours * 3_600_000) overdueQueued++;
    if (t.status === "running" && t.locked_at && now.getTime() - new Date(t.locked_at).getTime() > stuckMinutes * 60_000) stuckRunning++;
  }
  return { overdueQueued, stuckRunning };
}
