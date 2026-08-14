import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { CouponForm } from "@/components/dashboard/coupon-form";

export default async function AdminCouponsPage() {
  const supabase = await createClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_value, applies_to, max_redemptions, redemption_count, active, expires_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Coupons</h1>

      <div className="mb-8 rounded-chip border border-line bg-white p-5">
        <p className="mb-4 text-sm font-medium">Create a new coupon</p>
        <CouponForm />
      </div>

      <div className="space-y-3">
        {coupons?.map((c) => (
          <div key={c.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono font-medium">{c.code}</span>
              <div className="flex gap-2">
                <MetricChip
                  label="Discount"
                  value={c.discount_type === "percent" ? `${c.discount_value}%` : `৳${c.discount_value}`}
                  tone="price"
                />
                <MetricChip label={c.active ? "Active" : "Inactive"} value={c.applies_to} tone={c.active ? "verified" : "default"} />
              </div>
            </div>
            <p className="text-xs text-muted">
              Used {c.redemption_count}
              {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""} times
              {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : " · no expiry"}
            </p>
          </div>
        ))}
        {!coupons?.length && <p className="text-muted">No coupons yet.</p>}
      </div>
    </div>
  );
}
