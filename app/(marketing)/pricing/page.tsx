import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple pricing for buyers and sellers on LinkLazy.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Pricing</h1>
      <p className="mb-10 text-muted">Choose the plan that fits how you use LinkLazy.</p>

      <div className="mb-12">
        <h2 className="mb-4 font-display text-xl font-medium">For sellers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-chip border border-line bg-white p-6">
            <p className="mb-1 text-sm font-medium">Commission plan</p>
            <p className="mb-4 text-2xl font-display">15–20%</p>
            <p className="text-sm text-muted">
              No upfront cost. We take a commission only when you complete a
              paid order. High-volume verified sellers qualify for a reduced
              rate.
            </p>
          </div>
          <div className="rounded-chip border border-line bg-white p-6">
            <p className="mb-1 text-sm font-medium">Monthly plan</p>
            <p className="mb-4 text-2xl font-display">Fixed fee/mo</p>
            <p className="text-sm text-muted">
              Pay a flat monthly fee and keep 100% of what buyers pay for
              your links. Best for sellers with steady order volume.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl font-medium">For buyers</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { name: "Free", views: "Browse metrics only", cta: "Sign up" },
            { name: "Starter", views: "10 unlocks/mo", cta: "Choose Starter" },
            { name: "Growth", views: "20 unlocks/mo", cta: "Choose Growth" },
            { name: "Pro", views: "50 unlocks/mo", cta: "Choose Pro" },
          ].map((plan) => (
            <div key={plan.name} className="rounded-chip border border-line bg-white p-5 text-center">
              <p className="mb-1 font-medium">{plan.name}</p>
              <p className="mb-4 text-sm text-muted">{plan.views}</p>
              <Link href="/register">
                <Button size="sm" variant="secondary" className="w-full">
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
