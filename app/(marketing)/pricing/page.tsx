import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Lock, ShieldCheck, Sparkles, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/currency/money";

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

/**
 * Maps a marketing pricing_plans row to the fixed plan slug the checkout
 * flow understands (see the `plan` enum in /api/billing/subscribe).
 * Buyer slugs: starter | growth | pro. Seller slugs: monthly | commission.
 * Falls back to "starter"/"commission" (the free tiers) if a name doesn't
 * match anything recognized, so a signup never dead-ends.
 */
function toPlanSlug(group: "buyer" | "seller", name: string): string {
  const n = name.toLowerCase();
  if (group === "seller") {
    return n.includes("month") ? "monthly" : "commission";
  }
  if (n.includes("pro")) return "pro";
  if (n.includes("growth")) return "growth";
  return "starter";
}

function planHref(plan: PricingPlan, group: "buyer" | "seller") {
  const slug = toPlanSlug(group, plan.name);
  const params = new URLSearchParams({
    group,
    plan: slug,
    name: plan.name,
    price: String(plan.price_amount ?? 0),
  });
  return `/register?${params.toString()}`;
}

const FAQS = [
  {
    q: "How does escrow work?",
    a: "When a buyer pays for a placement, funds are held by LinkLazy until the buyer confirms the link is live and matches the order. Only then is the seller paid out — never released blind.",
  },
  {
    q: "Commission vs Monthly seller plan — which is better?",
    a: "Commission has no upfront cost — LinkLazy takes a percentage only on completed paid orders. The Monthly plan pays for itself once you're completing roughly 8–10 paid orders a month at typical placement prices — below that, Commission usually works out cheaper.",
  },
  {
    q: 'What counts as an "unlock"?',
    a: "Unlocking a listing reveals the seller's contact details and lets you place an order or start a moderated chat. Free accounts can browse metrics but can't unlock listings.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes — upgrade, downgrade, or cancel anytime from your dashboard billing settings; changes apply from your next billing cycle.",
  },
];

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
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-16 left-1/4 h-[300px] w-[300px] rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "#2C75FC" }}
          />
          <div
            className="absolute -top-10 right-1/4 h-[280px] w-[280px] rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "#B23CFC" }}
          />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 py-20">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-violet/20 bg-brand-soft px-3 py-1 font-mono text-xs uppercase tracking-widest text-brand-violet">
            <Sparkles className="h-3.5 w-3.5" />
            Simple, transparent pricing
          </p>
          <h1 className="mb-3 font-display text-4xl font-medium tracking-tight">
            Pricing that matches how you use LinkLazy
          </h1>
          <p className="text-lg text-muted">
            Browse and check metrics for free. Pay only when you&apos;re ready
            to unlock contact details, place paid orders, or sell placements
            — every order is escrow-protected until delivery is confirmed.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-violet" />
              Escrow protected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-signal" />
              No hidden fees
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-2 text-center font-display text-3xl font-medium tracking-tight">For buyers</h2>
        <p className="mx-auto mb-10 max-w-md text-center text-muted">
          Start free, upgrade when you're ready to unlock listings and place orders.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {buyerPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-chip border p-6 transition-shadow hover:shadow-md ${
                plan.highlight
                  ? "border-brand-violet/30 bg-brand-soft shadow-sm"
                  : "border-line bg-white"
              }`}
            >
              {plan.highlight && <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />}
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
              <Link href={planHref(plan, "buyer")} className="mt-6">
                <Button className="w-full" variant={plan.highlight ? "primary" : "secondary"}>
                  {plan.cta_label ?? "Choose plan"}
                </Button>
              </Link>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                    ) : (
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-line" />
                    )}
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

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-2 text-center font-display text-3xl font-medium tracking-tight">For sellers</h2>
          <p className="mx-auto mb-10 max-w-md text-center text-muted">
            List for free and pay commission only on completed sales, or go flat-rate monthly.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {sellerPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-chip border border-line bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
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
                <Link href={planHref(plan, "seller")} className="mt-6">
                  <Button className="w-full" variant="secondary">
                    {plan.cta_label ?? "Choose plan"}
                  </Button>
                </Link>
                <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
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

      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-10 flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-brand-violet" />
          <h2 className="font-display text-3xl font-medium tracking-tight">Pricing FAQ</h2>
        </div>
        <div className="flex flex-col divide-y divide-line">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5 first:pt-0 last:pb-0">
              <p className="font-medium text-ink">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
