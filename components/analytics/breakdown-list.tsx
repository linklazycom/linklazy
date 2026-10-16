import { percent, type Counted } from "@/lib/analytics/format";

/** Ranked list with proportional bars. `label` maps a raw key (e.g. "BD") to display text. */
export function BreakdownList({ title, rows, label }: { title: string; rows: Counted[]; label?: (key: string) => string }) {
  const total = rows.reduce((s, r) => s + r.clicks, 0);
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No data yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-xs">
              <div className="mb-0.5 flex justify-between gap-3">
                <span className="truncate" title={label ? label(r.key) : r.key}>
                  {label ? label(r.key) : r.key}
                </span>
                <span className="shrink-0 font-mono text-muted">
                  {r.clicks} · {percent(r.clicks, total)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-line/60">
                <div className="h-1.5 rounded-full bg-brand-violet" style={{ width: `${(r.clicks / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
