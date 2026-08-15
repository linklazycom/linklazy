import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/currency/money";
import { CurrencyToggle } from "@/components/currency/currency-provider";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple pricing for buyers and sellers on LinkLazy.",
};

interface Feature {
  label: string;
  included: boolean;
}

interface PricingPlan {
  id: string;
  name: string;
  price_amount: number | null;
  price_label: string | null;
  period: string;
  tagline: string;
  cta_label: string | null;
  highlight: boolean;
  features: Feature[];
}

export default async function PricingPage() {
  // Plan cards below are fully admin-editable at /admin/pricing — this page
  // just renders whatever's marked active there, in display_order.
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("pricing_plans")
    .select("id, plan_group, name, price_amount, price_label, period, tagline, cta_label, highlight, features")
    .eq("active", true)
    .order("display_order", { ascending: true });

  const buyerPlans = ((plans ?? []).filter((p) => p.plan_group === "buyer") as unknown) as PricingPlan[];
  const sellerPlans = ((plans ?? []).filter((p) => p.plan_group === "seller") as unknown) as PricingPlan[];

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line bg-white text-center">
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.05]" />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="mb-3 font-display text-3xl font-medium">
            Pricing that matches how you use LinkLazy
          </h1>
          <p className="text-muted">
            Browse and check metrics for free. Pay only when you're ready to
            unlock contact details, place paid orders, or sell placements —
            every order is escrow-protected until delivery is confirmed.
          </p>
          <div className="mt-4 flex justify-center">
            <CurrencyToggle />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-medium">For buyers</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {buyerPlans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-chip border p-6 ${
                plan.highlight
                  ? "border-brand-violet/30 bg-brand-soft"
                  : "border-line bg-white"
              }`}
            >
              {plan.highlight && (
                <span className="mb-3 w-fit rounded-chip bg-brand-gradient px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <p className="font-display text-lg font-medium">{plan.name}</p>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
              <div className="mt-4">
                <span className="text-2xl font-display">
                  {plan.price_label ?? (
                    <>
                      <Money amount={plan.price_amount ?? 0} />
                      {plan.period !== "forever" && <span className="text-lg">/mo</span>}
                    </>
                  )}
                </span>
                {plan.period && plan.period !== "forever" && (
                  <span className="ml-1 text-sm text-muted">{plan.period}</span>
                )}
              </div>
              <Link href="/register" className="mt-6">
                <Button className="w-full" variant={plan.highlight ? "primary" : "secondary"}>
                  {plan.cta_label ?? "Choose plan"}
                </Button>
              </Link>
              <ul className="mt-6 flex flex-col gap-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    <span className={f.included ? "text-signal" : "text-line"}>
                      {f.included ? "✓" : "–"}
                    </span>
                    <span className={f.included ? "text-ink" : "text-muted line-through"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!buyerPlans.length && (
            <p className="col-span-full text-center text-muted">
              No buyer plans configured yet — add some in the admin panel.
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-medium">For sellers</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {sellerPlans.map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-chip border border-line p-6">
                <p className="font-display text-lg font-medium">{plan.name} plan</p>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                <div className="mt-4">
                  <span className="text-2xl font-display">
                    {plan.price_label ?? (
                      <>
                        <Money amount={plan.price_amount ?? 0} />
                        <span className="text-lg">/mo</span>
                      </>
                    )}
                  </span>
                  {plan.period && <span className="ml-1 text-sm text-muted">{plan.period}</span>}
                </div>
                <ul className="mt-6 flex flex-col gap-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      <span className="text-signal">✓</span>
                      <span className="text-ink">{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!sellerPlans.length && (
              <p className="col-span-full text-center text-muted">
                No seller plans configured yet — add some in the admin panel.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-medium">Pricing FAQ</h2>
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-medium">How does escrow work?</p>
            <p className="mt-1 text-sm text-muted">
              When a buyer pays for a placement, funds are held by LinkLazy
              until the buyer confirms the link is live and matches the
              order. Only then is the seller paid out — never released blind.
            </p>
          </div>
          <div>
            <p className="font-medium">
              Commission vs Monthly seller plan — which is better?
            </p>
            <p className="mt-1 text-sm text-muted">
              Commission has no upfront cost — LinkLazy takes a percentage
              only on completed paid orders. The Monthly plan pays for itself
              once you're completing roughly 8–10 paid orders a month at
              typical placement prices — below that, Commission usually works
              out cheaper.
            </p>
          </div>
          <div>
            <p className="font-medium">What counts as an "unlock"?</p>
            <p className="mt-1 text-sm text-muted">
              Unlocking a listing reveals the seller's contact details and
              lets you place an order or start a moderated chat. Free
              accounts can browse metrics but can't unlock listings.
            </p>
          </div>
          <div>
            <p className="font-medium">Can I change plans anytime?</p>
            <p className="mt-1 text-sm text-muted">
              Yes — upgrade, downgrade, or cancel anytime from your dashboard
              billing settings; changes apply from your next billing cycle.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
