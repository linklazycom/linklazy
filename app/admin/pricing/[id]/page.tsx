import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PricingPlanForm } from "@/components/admin/pricing-plan-form";

export default async function EditPricingPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase.from("pricing_plans").select("*").eq("id", id).single();

  if (!plan) notFound();

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Edit pricing plan</h1>
      <PricingPlanForm
        initial={{
          id: plan.id,
          plan_group: plan.plan_group,
          name: plan.name,
          price_amount: plan.price_amount,
          price_label: plan.price_label ?? "",
          period: plan.period ?? "",
          tagline: plan.tagline ?? "",
          cta_label: plan.cta_label ?? "",
          highlight: plan.highlight,
          active: plan.active,
          display_order: plan.display_order,
          features: Array.isArray(plan.features) && plan.features.length
            ? plan.features
            : [{ label: "", included: true }],
        }}
      />
    </div>
  );
}
