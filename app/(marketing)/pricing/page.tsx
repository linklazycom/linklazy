import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple pricing for buyers and sellers on LinkLazy.",
};

// TODO(Bilal): fill in every "৳__" placeholder — I don't have your real
// figures on file. Everything else (structure, feature list, FAQ copy,
// tokens) is production-ready as-is.
const buyerPlans = [
  {
    name: "Free",
    price: "৳0",
    period: "forever",
    tagline: "Browse the marketplace, no commitment.",
    cta: "Sign up",
    highlight: false,
    features: [
      { label: "Browse all verified listings & metrics", included: true },
      { label: "Unlock seller contact / place order", included: false },
      { label: "Saved searches", included: false },
      { label: "Email alerts on new matches", included: false },
      { label: "Escrow-protected checkout", included: true },
    ],
  },
  {
    name: "Starter",
    price: "৳__/mo",
    period: "billed monthly",
    tagline: "For occasional link building.",
    cta: "Choose Starter",
    highlight: false,
    features: [
      { label: "10 unlocks / month", included: true },
      { label: "Unlock seller contact / place order", included: true },
      { label: "Saved searches (up to 3)", included: true },
      { label: "Email alerts on new matches", included: true },
      { label: "Escrow-protected checkout", included: true },
    ],
  },
  {
    name: "Growth",
    price: "৳__/mo",
    period: "billed monthly",
    tagline: "For agencies running regular campaigns.",
    cta: "Choose Growth",
    highlight: true,
    features: [
      { label: "20 unlocks / month", included: true },
      { label: "Unlock seller contact / place order", included: true },
      { label: "Saved searches (unlimited)", included: true },
      { label: "Email alerts on new matches", included: true },
      { label: "Escrow-protected checkout", included: true },
    ],
  },
  {
    name: "Pro",
    price: "৳__/mo",
    period: "billed monthly",
    tagline: "For high-volume buyers and SEO teams.",
    cta: "Choose Pro",
    highlight: false,
    features: [
      { label: "50 unlocks / month", included: true },
      { label: "Unlock seller contact / place order", included: true },
      { label: "Saved searches (unlimited)", included: true },
      { label: "Email alerts on new matches", included: true },
      { label: "Escrow-protected checkout", included: true },
    ],
  },
];

const sellerPlans = [
  {
    name: "Commission",
    price: "15–20%",
    period: "per completed paid order",
    tagline: "No upfront cost — pay only when you earn.",
    features: [
      "List unlimited sites for free",
      "Verified-owner badge on approval",
      "Escrow payout after buyer confirms delivery",
      "Reduced rate for high-volume verified sellers", // TODO(Bilal): confirm exact reduced % + threshold
      "Bronze / Silver / Gold seller tier badges",
    ],
  },
  {
    name: "Monthly",
    price: "৳__/mo",
    period: "flat fee",
    tagline: "Keep 100% of what buyers pay you.",
    features: [
      "Unlimited paid orders, 0% commission",
      "Verified-owner badge on approval",
      "Escrow payout after buyer confirms delivery",
      "Priority placement in search results",
      "Bronze / Silver / Gold seller tier badges",
    ],
  },
];

export default function PricingPage() {
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
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-medium">For buyers</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {buyerPlans.map((plan) => (
            <div
              key={plan.name}
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
                <span className="text-2xl font-display">{plan.price}</span>
                <span className="ml-1 text-sm text-muted">{plan.period}</span>
              </div>
              <Link href="/register" className="mt-6">
                <Button className="w-full" variant={plan.highlight ? "primary" : "secondary"}>
                  {plan.cta}
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
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-medium">For sellers</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {sellerPlans.map((plan) => (
              <div key={plan.name} className="flex flex-col rounded-chip border border-line p-6">
                <p className="font-display text-lg font-medium">{plan.name} plan</p>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                <div className="mt-4">
                  <span className="text-2xl font-display">{plan.price}</span>
                  <span className="ml-1 text-sm text-muted">{plan.period}</span>
                </div>
                <ul className="mt-6 flex flex-col gap-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-signal">✓</span>
                      <span className="text-ink">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
              only on completed paid orders. Monthly is a flat fee with 0%
              commission, better value once your order volume is high enough.
              {" "}
              {/* TODO(Bilal): add a concrete break-even example once the monthly fee is set */}
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
