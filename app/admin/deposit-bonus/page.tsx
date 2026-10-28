import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { BonusSettingsForm } from "@/components/admin/bonus/bonus-settings-form";
import { BonusRowActions } from "@/components/admin/bonus/bonus-row-actions";
import { getBonusSettings } from "@/lib/deposit-bonus-server";

export const metadata = { title: "Admin · Deposit bonus" };

export default async function AdminDepositBonusPage() {
  const supabase = await createClient();
  const settings = await getBonusSettings();
  const { data: rows } = await supabase
    .from("wallet_bonuses")
    .select("id, user_id, topup_amount, bonus_amount, remaining, status, provider, created_at, clawed_back_amount")
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
  const { data: users } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const granted = (rows ?? []).filter((r) => r.status === "granted");
  const totalGiven = granted.reduce((s, r) => s + Number(r.bonus_amount), 0);
  const totalUnspent = granted.reduce((s, r) => s + Number(r.remaining), 0);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Deposit bonus</h1>
        <p className="text-sm text-muted">
          Extra wallet credit on larger top-ups. The bonus can be spent on LinkLazy (bonus is used first) but can never be withdrawn. It is OFF until you switch it on.
        </p>
      </div>
      <BonusSettingsForm enabled={settings.enabled} minAmount={settings.minAmount} percent={settings.percent} maxBonus={settings.maxBonus} />
      <div className="flex flex-wrap gap-2">
        <MetricChip label="Given (last 100)" value={`৳${totalGiven.toLocaleString()}`} tone="price" />
        <MetricChip label="Still unspent" value={`৳${totalUnspent.toLocaleString()}`} />
      </div>
      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-chip border border-line bg-white p-3 text-sm">
            <div>
              <p className="font-medium">
                ৳{Number(r.bonus_amount).toLocaleString()} bonus on ৳{Number(r.topup_amount).toLocaleString()} · {names.get(r.user_id as string) ?? "User"}
              </p>
              <p className="text-xs text-muted">
                {new Date(r.created_at).toLocaleString()} · {r.provider ?? "—"} · unspent ৳{Number(r.remaining).toLocaleString()}
                {r.clawed_back_amount !== null && r.clawed_back_amount !== undefined ? ` · taken back ৳${Number(r.clawed_back_amount).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MetricChip label="Status" value={String(r.status).replace("_", " ")} tone={r.status === "granted" ? "verified" : "default"} />
              <BonusRowActions id={r.id} status={r.status} remaining={Number(r.remaining)} />
            </div>
          </div>
        ))}
        {!rows?.length && <p className="text-muted">No bonuses yet.</p>}
      </div>
    </div>
  );
}
