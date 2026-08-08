import type { Metadata } from "next";

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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-10 font-display text-3xl font-medium">How it works</h1>
      <ol className="space-y-8">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">
              {i + 1}
            </span>
            <div>
              <p className="mb-1 font-medium">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
