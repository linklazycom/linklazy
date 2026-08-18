import type { Metadata } from "next";
import { Route } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "How It Works",
  description: "How buying and selling backlinks works on LinkLazy.",
};

const STEPS = [
  {
    title: "List or browse",
    body: "Sellers list a site with verified metrics and ownership proof. Buyers browse listings filtered by niche, DA, price, and link type.",
  },
  {
    title: "Request a link",
    body: "Buyers either propose a direct exchange (listing their own site) or pay for placement — the seller sets which options each site accepts.",
  },
  {
    title: "Delivery & proof",
    body: "The seller places the link within the agreed turnaround time and submits the live URL as proof, automatically archived for a permanent record.",
  },
  {
    title: "Confirm & release",
    body: "The buyer confirms the link is live and correct. For paid orders, payment is released to the seller at that point — not before.",
  },
  {
    title: "Review",
    body: "Both sides leave a review, building the trust signals that help future buyers and sellers make faster decisions.",
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <PageHero
        eyebrow="The full flow"
        eyebrowIcon={Route}
        title="How it works"
        description="From listing to a confirmed, paid-out link — five steps, every one of them provable."
      />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <ol className="space-y-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-sm font-semibold text-white shadow-sm">
                {i + 1}
              </span>
              <div>
                <p className="mb-1 font-medium text-ink">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
