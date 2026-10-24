/** A small number card for the admin overview pages. */
export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-chip border border-line bg-white p-3 text-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-xl">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
