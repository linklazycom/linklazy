import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";
import { DeletePlanButton } from "@/components/admin/delete-plan-button";

export default async function AdminPricingPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("pricing_plans")
    .select("id, plan_group, name, price_amount, price_label, period, active, highlight, display_order")
    .order("plan_group", { ascending: true })
    .order("display_order", { ascending: true });

  const buyerPlans = (plans ?? []).filter((p) => p.plan_group === "buyer");
  const sellerPlans = (plans ?? []).filter((p) => p.plan_group === "seller");

  function PlanRow({ plan }: { plan: (typeof buyerPlans)[number] }) {
    return (
      <div className="flex items-center justify-between rounded-chip border border-line bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{plan.name}</span>
            {plan.highlight && (
              <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-semibold text-white">
                Highlighted
              </span>
            )}
            {!plan.active && <MetricChip label="Hidden" value="Inactive" />}
          </div>
          <p className="mt-1 text-sm text-muted">
            {plan.price_label ?? (plan.price_amount != null ? `৳${plan.price_amount}` : "—")}
            {plan.period ? ` · ${plan.period}` : ""} · order {plan.display_order}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/pricing/${plan.id}`}>
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </Link>
          <DeletePlanButton planId={plan.id} planName={plan.name} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">Pricing page</h1>
          <p className="mt-1 text-sm text-muted">
            Everything shown on the public{" "}
            <Link href="/pricing" target="_blank" className="underline">
              /pricing
            </Link>{" "}
            page — plans, prices, and feature lists — is edited here.
          </p>
        </div>
        <Link href="/admin/pricing/new">
          <Button>Add plan</Button>
        </Link>
      </div>

      <h2 className="mb-3 font-display text-lg font-medium">Buyer plans</h2>
      <div className="mb-8 space-y-2">
        {buyerPlans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
        {!buyerPlans.length && <p className="text-muted">No buyer plans yet.</p>}
      </div>

      <h2 className="mb-3 font-display text-lg font-medium">Seller plans</h2>
      <div className="space-y-2">
        {sellerPlans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
        {!sellerPlans.length && <p className="text-muted">No seller plans yet.</p>}
      </div>
    </div>
  );
}
